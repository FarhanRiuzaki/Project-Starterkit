// Sign-in (password, LDAP, second factor), sign-out, reset links and re-authentication. Port of
// apps/web/src/lib/server/sign-in.ts and the /v1/auth handlers of the former Hono router.
import { and, eq, getTableColumns, isNotNull, not, or, type SQL, sql } from "drizzle-orm";
import type { AuthLogDto } from "@starterkit/shared/contracts/audit";
import type { AuthMethod, LoginBody, ResetPasswordBody, TwoFactorBody } from "@starterkit/shared/contracts/auth";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { config } from "../../kernel/config";
import { decryptSecret, hashToken, randomToken } from "../../kernel/crypto";
import { db, type Tx } from "../../kernel/db";
import { ApiError, tooManyAttempts } from "../../kernel/errors";
import { log } from "../../kernel/log";
import { sendMail } from "../../kernel/mailer";
import type { Client } from "../../kernel/plugins/context";
import { recordAuth } from "../audit";
import { advanceTotpStep, markRecoveryCodeUsed, setPassword, stampSignIn, unusedRecoveryCodes, users } from "../users";
import { directory } from "./ldap";
import { forgotLimits, loginGate, loginLimits, passwordFails, retryText } from "./limits";
import { hashPassword, verifyPassword } from "./password";
import { isTotpCode, twoFactorPath } from "./rules";
import { authChallenges, sessions, userTokens } from "./schema";
import { createSession, deviceOf, endUserSessions, providersOf, rolesOf, toUserRow, type UserRow } from "./sessions";
import { matchTotpStep } from "./totp";

const BAD_LOGIN = "The sign-in details don't match an account. Check them and the sign-in method, then try again.";
const EXPIRED = "The sign-in expired. Start again with your email and password.";
const BAD_CODE = "That code didn't match. Enter the current code from your authenticator app or an unused recovery code.";
const BAD_LINK = "This reset link expired or was already used. Request a new link.";

async function selectUser(where: SQL | undefined): Promise<UserRow | null> {
  const [r] = await db.select({ ...getTableColumns(users), roles: rolesOf(users.id), connected: await providersOf(users.id) }).from(users).where(where);
  return r ? toUserRow(r) : null;
}

/** A user by email or username, case-insensitive. */
export function findUser(login: string): Promise<UserRow | null> {
  const key = login.trim().toLowerCase();
  return selectUser(or(eq(sql`lower(${users.email})`, key), eq(sql`lower(${users.username})`, key)));
}

/** A user by id. */
export const userById = (id: string): Promise<UserRow | null> => selectUser(eq(users.id, id));

/** One sign-in log entry for this request (IP and device from the client headers), through `tx`. */
export function logAuth(tx: Tx, client: Client, event: AuthLogDto["event"], method: AuthMethod, login: string, userId: string | null): Promise<void> {
  return recordAuth(tx, { event, method, login, userId, ip: client.ip, device: deviceOf(client.ua), location: null });
}

/** Full sign-in inside `tx`: a new session (device, IP, method) and the user's lastLoginAt stamped. Returns the session token. */
export async function completeSignIn(tx: Tx, user: UserRow, method: AuthMethod, client: Client): Promise<string> {
  const { token } = await createSession(tx, { userId: user.id, method, client });
  await stampSignIn(tx, user.id);
  return token;
}

/** An unused recovery code of the user (any letter case) is marked used: true once per code. */
export async function spendRecoveryCode(userId: string, code: string): Promise<boolean> {
  const plain = code.trim().toLowerCase();
  const rows = await unusedRecoveryCodes(userId);
  const hits = await Promise.all(rows.map((r) => verifyPassword(plain, r.codeHash)));
  const hit = rows[hits.indexOf(true)];
  return !!hit && (await markRecoveryCodeUsed(hit.id));
}

/**
 * Re-authentication of the signed-in user before a credential or identity change (password, email, turning 2FA off):
 * the account password (the directory password for LDAP users), or, for `recoveryCode`, an unused recovery code
 * (spent on success). Wrong proofs share one soft backoff per user (passwordFails: 5 free, then 1 s, 2 s …), reserved
 * before anything is verified. Resolves when confirmed; else throws 400 invalid_credentials / invalid_code or 429.
 */
export async function reauth(u: UserRow, proof: { password: string } | { recoveryCode: string }): Promise<void> {
  // The attempt is reserved as a failure in one statement, so parallel guesses can't all read "no wait"; a right proof clears it.
  const wait = Math.ceil((await passwordFails.reserve(u.id)) / 1000);
  if (wait > 0) throw tooManyAttempts(wait, retryText(wait));
  let ok: boolean;
  try {
    ok = "recoveryCode" in proof
      ? await spendRecoveryCode(u.id, proof.recoveryCode)
      : u.isLdap
        ? (await directory()?.verify(u.username, proof.password)) ?? false
        : await verifyPassword(proof.password, u.passwordHash);
  } catch (e) {
    await passwordFails.release(u.id); // no verdict (directory unreachable): the attempt doesn't count
    throw e;
  }
  if (!ok) {
    // 400, not 401: a 401 would make the browser think the session ended
    throw "recoveryCode" in proof
      ? new ApiError("invalid_code", "That recovery code didn't match or was already used. Check it and try again.")
      : new ApiError("invalid_credentials", "The current password is wrong. Check it and try again.", undefined, 400);
  }
  await passwordFails.succeed(u.id);
}

/** Spends every reset and invitation link of the user. */
export async function deleteUserTokens(tx: Tx, userId: string): Promise<void> {
  await tx.delete(userTokens).where(eq(userTokens.userId, userId));
}

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
  return step !== null && (await advanceTotpStep(user.id, step));
}

/**
 * Sign-in step 1. Unknown login, wrong password and the wrong method for the account share one answer; an inactive
 * account is named only after the right credential. A user with 2FA gets only a challenge (10 minutes), no session.
 */
export async function login(b: LoginBody, client: Client): Promise<{ next: string; challenge: string } | { next: string; token: string }> {
  const user = await findUser(b.login);
  const name = (user?.username ?? b.login.trim()).toLowerCase();
  // The log names the account by its email when the login matched one, else by what was typed.
  const login = user?.email ?? b.login;
  const fail = () => logAuth(db, client, "login_failed", b.method, login, user?.id ?? null);
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
    await db.transaction(async (tx) => {
      await tx.insert(authChallenges).values({
        id: Bun.randomUUIDv7(), tokenHash: hashToken(challenge), userId: user.id, method: b.method, expiresAt: sql`now() + interval '10 minutes'`,
      });
      await logAuth(tx, client, "password_ok", b.method, login, user.id); // not a sign-in yet: the code step logs 2fa_success
    });
    return { next: twoFactorPath(next), challenge };
  }
  const token = await db.transaction(async (tx) => {
    const t = await completeSignIn(tx, user, b.method, client);
    await logAuth(tx, client, "login_success", b.method, login, user.id);
    return t;
  });
  return { next, token };
}

/**
 * Sign-in step 2 with the challenge `key` (`X-Auth-Challenge`): only a challenge younger than 10 minutes gets here (an
 * older one is deleted); a 6-digit TOTP (each one once) or a recovery code (each one once) finishes it and deletes the
 * challenge.
 */
export async function secondFactor(key: string | null, b: TwoFactorBody, client: Client): Promise<{ next: string; token: string }> {
  const [p] = key
    ? await db.select({ id: authChallenges.id, userId: authChallenges.userId, method: authChallenges.method, live: sql<boolean>`${authChallenges.expiresAt} > now()` })
      .from(authChallenges).where(eq(authChallenges.tokenHash, hashToken(key)))
    : [];
  const user = p?.live ? await userById(p.userId) : null;
  if (!p?.live || !user?.totpSecret) {
    if (p) await db.delete(authChallenges).where(eq(authChallenges.id, p.id));
    throw new ApiError("unauthenticated", EXPIRED);
  }
  const method = p.method as AuthMethod;
  const name = user.username.toLowerCase();
  const fail = () => logAuth(db, client, "2fa_failed", method, user.email, user.id);
  const wait = await loginGate(loginLimits, { step: "otp", ip: client.ip, username: name });
  if (wait != null) {
    await fail();
    throw tooManyAttempts(wait, retryText(wait));
  }
  const ok = isTotpCode(b.code) ? await totpOk(user, b.code) : await spendRecoveryCode(user.id, b.code);
  if (!ok) {
    await fail();
    throw new ApiError("invalid_code", BAD_CODE);
  }
  await loginLimits.user.succeed(name);
  if (!user.isActive) { // deactivated between the two steps
    await db.delete(authChallenges).where(eq(authChallenges.id, p.id));
    await fail();
    throw new ApiError("account_inactive");
  }
  const token = await db.transaction(async (tx) => {
    // Deleted in the same transaction: of two concurrent finishes of one challenge, only one gets a session.
    // ponytail: the loser has already spent its code (TOTP step or recovery code); fine for one user racing themself.
    const gone = await tx.delete(authChallenges).where(eq(authChallenges.id, p.id)).returning({ id: authChallenges.id });
    if (!gone.length) throw new ApiError("unauthenticated", EXPIRED);
    const t = await completeSignIn(tx, user, method, client);
    await logAuth(tx, client, "2fa_success", method, user.email, user.id);
    return t;
  });
  return { next: afterSignIn(b.next), token };
}

/** Sign out: ends the bearer's session (`logout` entry) and/or deletes the challenge. */
export async function logout(token: string | undefined, challenge: string | null, client: Client): Promise<void> {
  if (token) {
    const [s] = await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).returning({ userId: sessions.userId, method: sessions.method });
    const [u] = s ? await db.select({ email: users.email }).from(users).where(eq(users.id, s.userId)) : [];
    if (s && u) await logAuth(db, client, "logout", s.method as AuthMethod, u.email, s.userId);
  }
  if (challenge) await db.delete(authChallenges).where(eq(authChallenges.tokenHash, hashToken(challenge)));
}

/**
 * Request a reset link. The answer is the same whether or not the email belongs to an account, and whether or not the
 * request was throttled (forgotLimits: per IP and per email; a throttled request sends nothing). For an active user
 * with a password (not LDAP, not Google/Apple only) a random token (stored hashed, 30 minutes, single use) is mailed
 * after it is stored.
 */
export async function forgot(email: string, client: Client): Promise<void> {
  const key = email.toLowerCase();
  // Both limiters count every request (known email or not), so throttling reveals nothing either.
  const waits = await Promise.all([forgotLimits.ip.hit(client.ip), forgotLimits.email.hit(key)]);
  if (waits.some((w) => w !== null)) return;
  const [u] = await db.select({ id: users.id, email: users.email }).from(users)
    .where(and(eq(sql`lower(${users.email})`, key), users.isActive, not(users.isLdap), isNotNull(users.passwordHash)));
  if (!u) return;
  const token = randomToken();
  // One live link per user: this one replaces the earlier one.
  // ponytail: a known email costs this one extra round trip over an unknown one (same body); queue the write if it matters.
  await db.insert(userTokens).values({ tokenHash: hashToken(token), userId: u.id, kind: "reset", expiresAt: sql`now() + interval '30 minutes'` })
    .onConflictDoUpdate({ target: userTokens.userId, set: { tokenHash: sql`excluded.token_hash`, kind: sql`excluded.kind`, expiresAt: sql`excluded.expires_at` } });
  sendMail({
    to: u.email,
    subject: "Reset your password",
    text: `Someone asked to reset the password of your account. Open this link within 30 minutes to choose a new one:\n\n`
      + `${config().APP_URL}/reset-password?token=${token}\n\nIf it wasn't you, ignore this email; your password stays the same.`,
  });
}

/**
 * Set a new password with a reset or invitation token. The token is spent on first use, even when expired or refused
 * (directory user); all of the user's sessions end.
 */
export async function reset(b: ResetPasswordBody, client: Client): Promise<void> {
  const [t] = await db.delete(userTokens).where(eq(userTokens.tokenHash, hashToken(b.token)))
    .returning({ userId: userTokens.userId, live: sql<boolean>`${userTokens.expiresAt} > now()` });
  const [u] = t ? await db.select({ id: users.id, email: users.email, isLdap: users.isLdap }).from(users).where(eq(users.id, t.userId)) : [];
  if (!t?.live || !u || u.isLdap) throw new ApiError("invalid_code", BAD_LINK);
  const hash = await hashPassword(b.password);
  await db.transaction(async (tx) => {
    await setPassword(tx, u.id, hash);
    await endUserSessions(tx, u.id);
    await logAuth(tx, client, "password_reset", "password", u.email, u.id);
  });
  log.info({ userId: u.id }, "password reset");
}
