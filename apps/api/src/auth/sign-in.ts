// Port of apps/web/src/lib/server/sign-in.ts. deviceOf lives in ./sessions (createSession needs it).
import type { SQL } from "bun";
import type { AuthLogDto } from "@starterkit/shared/contracts/audit";
import type { AuthMethod } from "@starterkit/shared/contracts/auth";
import { recordAuth } from "../audit/record";
import { sql, type Tx } from "../db/client";
import type { Fragment } from "../db/page";
import { ApiError, tooManyAttempts } from "../http/errors";
import { directory } from "./ldap";
import { passwordFails, retryText } from "./limits";
import { verifyPassword } from "./password";
import { createSession, deviceOf, toUserRow, type UserRow } from "./sessions";

type Client = { ip: string; ua: string };

const selectUser = async (where: Fragment): Promise<UserRow | null> => {
  const [r] = await sql`
    select u.*,
      array(select r.name from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id order by r.name) as roles,
      array(select i.provider from user_identities i where i.user_id = u.id order by i.provider) as connected
    from users u where ${where}`;
  return r ? toUserRow(r) : null;
};

/** A user by email or username, case-insensitive. */
export const findUser = (login: string): Promise<UserRow | null> => {
  const key = login.trim().toLowerCase();
  return selectUser(sql`lower(u.email) = ${key} or lower(u.username) = ${key}`);
};

/** A user by id. */
export const userById = (id: string): Promise<UserRow | null> => selectUser(sql`u.id = ${id}`);

/** No password and not a directory user: the account signs in only through a connected Google or Apple account. */
export const oauthOnly = (u: UserRow): boolean => !u.passwordHash && !u.isLdap;

/** One sign-in log entry for this request (IP and device from the client headers). */
export function logAuth(db: SQL, client: Client, event: AuthLogDto["event"], method: AuthMethod, login: string, userId: string | null): Promise<void> {
  return recordAuth(db, { event, method, login, userId, ip: client.ip, device: deviceOf(client.ua), location: null });
}

/** Full sign-in inside `tx`: a new session (device, IP, method) and the user's lastLoginAt stamped. Returns the session token. */
export async function completeSignIn(tx: Tx, user: UserRow, method: AuthMethod, client: Client): Promise<string> {
  const { token } = await createSession(tx, { userId: user.id, method, client });
  await tx`update users set last_login_at = now() where id = ${user.id}`;
  return token;
}

/** An unused recovery code of the user (any letter case) is marked used: true once per code. */
export async function spendRecoveryCode(userId: string, code: string): Promise<boolean> {
  const plain = code.trim().toLowerCase();
  const rows: { id: string; code_hash: string }[] = await sql`select id, code_hash from recovery_codes where user_id = ${userId} and used_at is null`;
  const hits = await Promise.all(rows.map((r) => verifyPassword(plain, r.code_hash)));
  const hit = rows[hits.indexOf(true)];
  // `used_at is null` again: of two concurrent uses of one code, only one spends it
  return !!hit && (await sql`update recovery_codes set used_at = now() where id = ${hit.id} and used_at is null returning 1`).length === 1;
}

/**
 * Re-authentication of the signed-in user before a credential or identity change (password, email, turning 2FA off):
 * the account password (the directory password for LDAP users), or, for `recoveryCode`, an unused recovery code
 * (spent on success). Wrong proofs share one soft backoff per user (passwordFails: 5 free, then 1 s, 2 s …), checked
 * before anything is verified. Resolves when confirmed; else throws 400 invalid_credentials / invalid_code or 429.
 */
export async function reauth(u: UserRow, proof: { password: string } | { recoveryCode: string }): Promise<void> {
  const wait = Math.ceil((await passwordFails.retryAfterMs(u.id)) / 1000);
  if (wait > 0) throw tooManyAttempts(wait, retryText(wait));
  const ok = "recoveryCode" in proof
    ? await spendRecoveryCode(u.id, proof.recoveryCode)
    : u.isLdap
      ? (await directory()?.verify(u.username, proof.password)) ?? false
      : await verifyPassword(proof.password, u.passwordHash);
  if (!ok) {
    await passwordFails.fail(u.id);
    // 400, not 401: a 401 would make the browser think the session ended
    throw "recoveryCode" in proof
      ? new ApiError("invalid_code", "That recovery code didn't match or was already used. Check it and try again.")
      : new ApiError("invalid_credentials", "The current password is wrong. Check it and try again.", undefined, 400);
  }
  await passwordFails.succeed(u.id);
}
