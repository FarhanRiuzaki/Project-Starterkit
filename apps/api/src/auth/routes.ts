// /v1/auth/*: port of apps/web/src/app/api/auth/{login,2fa,logout,forgot,reset}, plus the Google/Apple flow (oauth.ts).
// The web keeps the cookie, CSRF and same-origin checks; here a full sign-in answers `token` and a pending second
// factor answers `challenge`.
import { Hono } from "hono";
import { AuthContextDto, ForgotPasswordBody, LoginBody, ResetPasswordBody, TwoFactorBody } from "@starterkit/shared/contracts/auth";
import { ConnectionProvider } from "@starterkit/shared/contracts/me";
import { PERMISSIONS } from "@starterkit/shared/permissions";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { recordActivity } from "../audit/record";
import { config } from "../config";
import { sql } from "../db/client";
import { ApiError, tooManyAttempts } from "../http/errors";
import { bearer, guard } from "../http/guard";
import type { AppEnv } from "../http/middleware";
import { body } from "../http/parse";
import { log } from "../log";
import { sendMail } from "../mail/mailer";
import { decryptSecret, hashToken, randomToken, safeEqual } from "./crypto";
import { directory } from "./ldap";
import { forgotLimits, loginGate, loginLimits, retryText } from "./limits";
import { authorizeUrl, identityOf, OAuthCallbackBody, OAuthStartBody, providerEnabled } from "./oauth";
import { hashPassword, verifyPassword } from "./password";
import { endUserSessions, type UserRow } from "./sessions";
import { completeSignIn, findUser, logAuth, spendRecoveryCode, userById } from "./sign-in";
import { matchTotpStep } from "./totp";

const BAD_LOGIN = "The sign-in details don't match an account. Check them and the sign-in method, then try again.";
const EXPIRED = "The sign-in expired. Start again with your email and password.";
const BAD_CODE = "That code didn't match. Enter the current code from your authenticator app or an unused recovery code.";
const BAD_LINK = "This reset link expired or was already used. Request a new link.";

/**
 * Password users by argon2 hash; LDAP users only by the LDAP method, against the directory. Every login costs the same
 * work whatever it matched: one argon2 verify (a null hash when no password user matched), or one directory check
 * (the typed login when no LDAP user matched; one dummy argon2 verify when no directory is configured).
 */
async function credentialOk(user: UserRow | null, login: string, method: "password" | "ldap", password: string): Promise<boolean> {
  if (method === "password") return verifyPassword(password, user && !user.isLdap ? user.passwordHash : null);
  const dir = directory();
  const ok = dir ? await dir.verify(user?.isLdap ? user.username : login.trim(), password) : await verifyPassword(password, null);
  return ok && !!user?.isLdap;
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
  const ok = await credentialOk(user, b.login, b.method, b.password);
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
  // Six digits are a TOTP code only; anything else a recovery code only (a wrong TOTP costs no argon2 verify).
  const ok = /^\d{6}$/.test(b.code) ? await totpOk(user, b.code) : await spendRecoveryCode(user.id, b.code);
  if (!ok) {
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
    // ponytail: the loser has already spent its code (TOTP step or recovery code); fine for one user racing themself.
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
    // ponytail: a known email costs this one extra round trip over an unknown one (same body); queue the write if it matters.
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

const OAUTH_EXPIRED = "The sign-in with the provider expired or started in another browser. Start again.";
const NOT_CONNECTED = "This account isn't connected to a user here. Sign in another way, then connect it under Security.";

/** The provider of the path when it can sign in (mock or configured); else 404. */
function oauthProvider(name: string): ConnectionProvider {
  const p = ConnectionProvider.safeParse(name);
  if (!p.success || !providerEnabled(p.data)) throw new ApiError("not_found", "This sign-in provider isn't available.");
  return p.data;
}

/** Which providers can sign in (API-internal: the web hides or blocks the other buttons). */
authRoutes.get("/auth/providers", (c) => c.json({ google: providerEnabled("google"), apple: providerEnabled("apple") }));

/**
 * Start a provider sign-in (`login`) or a link to the signed-in user (`link`, bearer required): a state row (state
 * stored hashed, the browser binding's hash, PKCE verifier, nonce, who links, `next`; 10 minutes) and the URL the
 * browser goes to next.
 */
authRoutes.post("/auth/oauth/:provider/start", async (c) => {
  const b = await body(c, OAuthStartBody);
  const ctx = b.mode === "link" ? await guard(c, null) : null;
  const p = oauthProvider(c.req.param("provider"));
  const s = { state: randomToken(), verifier: randomToken(), nonce: randomToken() };
  // ponytail: rows of abandoned sign-ins stay until their 10 minutes pass and the janitor removes them; no per-IP cap on starts.
  await sql`insert into oauth_states (state_hash, provider, mode, user_id, binding_hash, code_verifier, nonce, next, expires_at)
    values (${hashToken(s.state)}, ${p}, ${b.mode}, ${ctx?.user.id ?? null}, ${Buffer.from(b.bindingHash, "base64url")}, ${s.verifier}, ${s.nonce},
      ${b.mode === "login" ? afterSignIn(b.next) : null}, now() + interval '10 minutes')`;
  return c.json({ url: authorizeUrl(p, s) });
});

/**
 * Finish a provider round trip. The state is spent on first use (also when expired, for another provider or with
 * another browser's binding: all 401). Login: only an identity already linked signs in (no new users, no match by
 * email); the provider counts as the second factor; answers `{ next, token }`. Link: the identity joins the user who
 * started it (one `me.connect` entry; already linked = no entry; linked to someone else = 409); answers `{ next }`.
 */
authRoutes.post("/auth/oauth/:provider/callback", async (c) => {
  const b = await body(c, OAuthCallbackBody);
  const p = oauthProvider(c.req.param("provider"));
  const client = c.var.client;
  const [s] = await sql`delete from oauth_states where state_hash = ${hashToken(b.state)}
    returning provider, mode, user_id, binding_hash, code_verifier, nonce, next, expires_at > now() as live`;
  if (!s?.live || s.provider !== p || !safeEqual(hashToken(b.binding).toString("hex"), Buffer.from(s.binding_hash).toString("hex"))) {
    throw new ApiError("unauthenticated", OAUTH_EXPIRED);
  }
  const id = await identityOf(p, b.code, { verifier: s.code_verifier, nonce: s.nonce, userId: s.user_id });
  if (s.mode === "link") {
    const user = await userById(s.user_id);
    if (!user?.isActive) throw new ApiError("unauthenticated");
    await sql.begin(async (tx) => {
      const added = await tx`insert into user_identities (user_id, provider, subject, email) values (${user.id}, ${p}, ${id.subject}, ${id.email})
        on conflict do nothing returning 1`;
      if (added.length) return recordActivity(tx, { user }, { action: "me.connect", target: { type: "user", id: user.id, label: user.name }, after: { provider: p } });
      // Not added: this identity is someone else's (409), or the user already has this provider (nothing to do).
      const [owner] = await tx`select user_id from user_identities where provider = ${p} and subject = ${id.subject}`;
      if (owner && owner.user_id !== user.id) throw new ApiError("duplicate", "This account is already connected to another user.");
    });
    return c.json({ next: `/me/security?connected=${p}` });
  }
  const [linked] = await sql`select user_id from user_identities where provider = ${p} and subject = ${id.subject}`;
  const user = linked ? await userById(linked.user_id) : null;
  const login = user?.email ?? id.email ?? id.subject;
  if (!user?.isActive) {
    await logAuth(sql, client, "login_failed", p, login, user?.id ?? null);
    throw user ? new ApiError("account_inactive") : new ApiError("invalid_credentials", NOT_CONNECTED);
  }
  const token = await sql.begin(async (tx) => {
    const t = await completeSignIn(tx, user, p, client);
    await logAuth(tx, client, "login_success", p, user.email, user.id);
    return t;
  });
  return c.json({ next: s.next ?? "/", token });
});
