// /v1/auth/*: port of apps/web/src/app/api/auth/{login,2fa,logout,forgot,reset}. The web keeps the cookie, CSRF and
// same-origin checks; here a full sign-in answers `token` and a pending second factor answers `challenge`.
import { Hono } from "hono";
import { AuthContextDto, ForgotPasswordBody, LoginBody, ResetPasswordBody, TwoFactorBody } from "@starterkit/shared/contracts/auth";
import { PERMISSIONS } from "@starterkit/shared/permissions";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { config } from "../config";
import { sql } from "../db/client";
import { ApiError, tooManyAttempts } from "../http/errors";
import { bearer, guard } from "../http/guard";
import type { AppEnv } from "../http/middleware";
import { body } from "../http/parse";
import { log } from "../log";
import { sendMail } from "../mail/mailer";
import { decryptSecret, hashToken, randomToken } from "./crypto";
import { directory } from "./ldap";
import { forgotLimits, loginGate, loginLimits, retryText } from "./limits";
import { hashPassword, verifyPassword } from "./password";
import { endUserSessions, type UserRow } from "./sessions";
import { completeSignIn, findUser, logAuth, spendRecoveryCode, userById } from "./sign-in";
import { matchTotpStep } from "./totp";

const BAD_LOGIN = "The sign-in details don't match an account. Check them and the sign-in method, then try again.";
const EXPIRED = "The sign-in expired. Start again with your email and password.";
const BAD_CODE = "That code didn't match. Enter the current code from your authenticator app or an unused recovery code.";
const BAD_LINK = "This reset link expired or was already used. Request a new link.";

/** Password users by argon2 hash (one verify for unknown logins too); LDAP users only by the LDAP method, against the directory. */
async function credentialOk(user: UserRow | null, method: "password" | "ldap", password: string): Promise<boolean> {
  if (method === "ldap") return !!user?.isLdap && ((await directory()?.verify(user.username, password)) ?? false);
  return verifyPassword(password, user && !user.isLdap ? user.passwordHash : null);
}

/** A TOTP code newer than the one that last completed a sign-in for this user (replay guard, one conditional UPDATE). */
async function totpOk(user: UserRow, code: string): Promise<boolean> {
  const step = matchTotpStep(decryptSecret(user.totpSecret!), code);
  return step !== null
    && (await sql`update users set totp_last_step = ${step} where id = ${user.id} and (totp_last_step is null or totp_last_step < ${step}) returning 1`).length === 1;
}

export const authRoutes = new Hono<AppEnv>();

/**
 * Sign-in step 1. Unknown login, wrong password and the wrong method for the account share one answer; an inactive
 * account is named only after the right credential. A user with 2FA gets only a challenge (10 minutes), no session.
 */
authRoutes.post("/auth/login", async (c) => {
  const b = await body(c, LoginBody);
  const client = c.var.client;
  const user = await findUser(b.login);
  const name = (user?.username ?? b.login.trim()).toLowerCase();
  // The log names the account by its email when the login matched one, else by what was typed.
  const login = user?.email ?? b.login;
  const fail = () => logAuth(sql, client, "login_failed", b.method, login, user?.id ?? null);
  // The gate reserves this attempt as a failure; it stays unless the credential is right.
  const wait = await loginGate(loginLimits, { step: "login", ip: client.ip, username: name });
  if (wait != null) {
    await fail();
    throw tooManyAttempts(wait, retryText(wait));
  }
  const ok = await credentialOk(user, b.method, b.password);
  if (!ok || !user) {
    await fail();
    throw new ApiError("invalid_credentials", BAD_LOGIN);
  }
  // With 2FA the sign-in isn't won yet: drop only this attempt's reservation, so earlier OTP failures keep counting.
  await (user.twoFactorEnabled ? loginLimits.user.release(name) : loginLimits.user.succeed(name));
  if (!user.isActive) {
    await fail();
    throw new ApiError("account_inactive");
  }
  const next = afterSignIn(b.next);
  if (user.twoFactorEnabled) {
    const challenge = randomToken();
    await sql.begin(async (tx) => {
      await tx`insert into auth_challenges (id, token_hash, user_id, method, expires_at)
        values (${Bun.randomUUIDv7()}, ${hashToken(challenge)}, ${user.id}, ${b.method}, now() + interval '10 minutes')`;
      await logAuth(tx, client, "password_ok", b.method, login, user.id); // not a sign-in yet: the code step logs 2fa_success
    });
    return c.json({ next: next === "/" ? "/login/2fa" : `/login/2fa?next=${encodeURIComponent(next)}`, challenge });
  }
  const token = await sql.begin(async (tx) => {
    const t = await completeSignIn(tx, user, b.method, client);
    await logAuth(tx, client, "login_success", b.method, login, user.id);
    return t;
  });
  return c.json({ next, token });
});

/**
 * Sign-in step 2 with `X-Auth-Challenge`: only a challenge younger than 10 minutes gets here (an older one is
 * deleted); a 6-digit TOTP (each one once) or a recovery code (each one once) finishes it and deletes the challenge.
 */
authRoutes.post("/auth/2fa", async (c) => {
  const b = await body(c, TwoFactorBody);
  const client = c.var.client;
  const key = c.req.header("x-auth-challenge");
  const [p] = key ? await sql`select id, user_id, method, expires_at > now() as live from auth_challenges where token_hash = ${hashToken(key)}` : [];
  const user = p?.live ? await userById(p.user_id) : null;
  if (!p?.live || !user?.totpSecret) {
    if (p) await sql`delete from auth_challenges where id = ${p.id}`;
    throw new ApiError("unauthenticated", EXPIRED);
  }
  const name = user.username.toLowerCase();
  const fail = () => logAuth(sql, client, "2fa_failed", p.method, user.email, user.id);
  const wait = await loginGate(loginLimits, { step: "otp", ip: client.ip, username: name });
  if (wait != null) {
    await fail();
    throw tooManyAttempts(wait, retryText(wait));
  }
  if (!(await totpOk(user, b.code)) && !(await spendRecoveryCode(user.id, b.code))) {
    await fail();
    throw new ApiError("invalid_code", BAD_CODE);
  }
  await loginLimits.user.succeed(name);
  if (!user.isActive) { // deactivated between the two steps
    await sql`delete from auth_challenges where id = ${p.id}`;
    await fail();
    throw new ApiError("account_inactive");
  }
  const token = await sql.begin(async (tx) => {
    // Deleted in the same transaction: of two concurrent finishes of one challenge, only one gets a session.
    if (!(await tx`delete from auth_challenges where id = ${p.id} returning 1`).length) throw new ApiError("unauthenticated", EXPIRED);
    const t = await completeSignIn(tx, user, p.method, client);
    await logAuth(tx, client, "2fa_success", p.method, user.email, user.id);
    return t;
  });
  return c.json({ next: afterSignIn(b.next), token });
});

/** Sign out: ends the bearer's session (`logout` entry) and/or deletes the `X-Auth-Challenge` challenge. Always `{ ok: true }`. */
authRoutes.post("/auth/logout", async (c) => {
  const token = bearer(c);
  const challenge = c.req.header("x-auth-challenge");
  if (token) {
    const [s] = await sql`with d as (delete from sessions where token_hash = ${hashToken(token)} returning user_id, method)
      select d.method, u.id, u.email from d join users u on u.id = d.user_id`;
    if (s) await logAuth(sql, c.var.client, "logout", s.method, s.email, s.id);
  }
  if (challenge) await sql`delete from auth_challenges where token_hash = ${hashToken(challenge)}`;
  return c.json({ ok: true });
});

/**
 * Request a reset link. The answer is the same whether or not the email belongs to an account, and whether or not the
 * request was throttled (forgotLimits: per IP and per email; a throttled request sends nothing). For an active user
 * with a password (not LDAP, not Google/Apple only) a random token (stored hashed, 30 minutes, single use) is mailed
 * after it is stored.
 */
authRoutes.post("/auth/forgot", async (c) => {
  const { email } = await body(c, ForgotPasswordBody);
  const key = email.toLowerCase();
  // Both limiters count every request (known email or not), so throttling reveals nothing either.
  const waits = await Promise.all([forgotLimits.ip.hit(c.var.client.ip), forgotLimits.email.hit(key)]);
  if (waits.some((w) => w !== null)) return c.json({ ok: true });
  const [u] = await sql`select id, email from users where lower(email) = ${key} and is_active and not is_ldap and password_hash is not null`;
  if (u) {
    const token = randomToken();
    // One live link per user: this one replaces the earlier one.
    await sql`insert into user_tokens (token_hash, user_id, kind, expires_at) values (${hashToken(token)}, ${u.id}, 'reset', now() + interval '30 minutes')
      on conflict (user_id) do update set token_hash = excluded.token_hash, kind = excluded.kind, expires_at = excluded.expires_at`;
    sendMail({
      to: u.email,
      subject: "Reset your password",
      text: `Someone asked to reset the password of your account. Open this link within 30 minutes to choose a new one:\n\n`
        + `${config().APP_URL}/reset-password?token=${token}\n\nIf it wasn't you, ignore this email; your password stays the same.`,
    });
  }
  return c.json({ ok: true });
});

/**
 * Set a new password with a reset or invitation token. The token is spent on first use, even when expired or refused
 * (directory user); all of the user's sessions end.
 */
authRoutes.post("/auth/reset", async (c) => {
  const { token, password } = await body(c, ResetPasswordBody);
  const [t] = await sql`delete from user_tokens t using users u where t.token_hash = ${hashToken(token)} and u.id = t.user_id
    returning u.id, u.email, u.is_ldap, t.expires_at > now() as live`;
  if (!t?.live || t.is_ldap) throw new ApiError("invalid_code", BAD_LINK);
  const hash = await hashPassword(password);
  await sql.begin(async (tx) => {
    await tx`update users set password_hash = ${hash} where id = ${t.id}`;
    await endUserSessions(tx, t.id);
    await logAuth(tx, c.var.client, "password_reset", "password", t.email, t.id);
  });
  log.info({ userId: t.id }, "password reset");
  return c.json({ ok: true });
});

/** The signed-in user and their permissions in catalog order (API-internal: the web's page guards). */
authRoutes.get("/auth/context", async (c) => {
  const { user, perms } = await guard(c, null);
  return c.json(AuthContextDto.parse({ user, permissions: PERMISSIONS.filter((p) => perms.has(p)) }));
});
