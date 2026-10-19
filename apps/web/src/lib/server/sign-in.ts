import "server-only";
import { randomUUID } from "node:crypto";
import type { IronSession } from "iron-session";
import type { AuthLogDto } from "@/lib/shared/contracts/audit";
import type { AuthMethod } from "@/lib/shared/contracts/auth";
import { apiError, clientIp, tooManyAttempts } from "./api";
import { recordAuth } from "./audit";
import { newCsrfToken, secureEquals } from "./csrf";
import { hashRecoveryCode, verifyPassword } from "./mock/password";
import { passwordFails, passwordKey, retryText } from "./ratelimit";
import { db, type UserRecord } from "./mock/db";
import { type AppSession, newSessionRecord } from "./session";

const MAX_SESSIONS = 10_000;

/** "Chrome on macOS" from a User-Agent; "Unknown device" when nothing matches. */
export function deviceOf(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return browser && os ? `${browser} on ${os}` : browser ?? os ?? "Unknown device";
}

const origin = (req: Request) => ({ ip: clientIp(req), device: deviceOf(req.headers.get("user-agent")) });

/** One sign-in log entry for this request (IP and device from the request). */
export function logAuth(req: Request, event: AuthLogDto["event"], method: AuthMethod, login: string, userId: string | null): void {
  recordAuth({ ...origin(req), event, method, login, userId, location: null });
}

/** A user by email or username, case-insensitive. */
export function findUser(login: string): UserRecord | undefined {
  const key = login.trim().toLowerCase();
  return [...db().users.values()].find((u) => u.email.toLowerCase() === key || u.username.toLowerCase() === key);
}

/**
 * Full sign-in: a new store session (device, IP, method) replaces any earlier one of this browser; the cookie gets
 * its sid and a fresh CSRF token, and loses the pending-2FA marker. Stamps the user's lastLoginAt.
 */
export async function completeSignIn(s: IronSession<AppSession>, user: UserRecord, method: AuthMethod, req: Request): Promise<void> {
  const sessions = db().sessions;
  if (s.sid) sessions.delete(s.sid);
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }
  const rec = newSessionRecord(randomUUID(), user.id, method, origin(req));
  sessions.set(rec.id, rec);
  const sid = rec.id;
  const now = rec.createdAt;
  s.sid = sid;
  s.csrf = newCsrfToken();
  s.pending2fa = undefined;
  await s.save();
  user.lastLoginAt = now;
}

/** No password and not a directory user: the account signs in only through a connected Google or Apple account. */
export const oauthOnly = (u: UserRecord): boolean => !u.passwordHash && !u.isLdap;

/**
 * Re-authentication of the signed-in user before a credential or identity change (password, email, turning 2FA off):
 * the account password (the directory password for LDAP users), or, for `recoveryCode`, an unused recovery code
 * (spent on success). Wrong proofs share one soft backoff per user (passwordFails: 5 free, then 1 s, 2 s …), checked
 * before anything is verified. Null = confirmed; else the answer to send (400 invalid_credentials / invalid_code, 429).
 */
export function reauth(u: UserRecord, proof: { password: string } | { recoveryCode: string }): Response | null {
  const key = passwordKey(u.id);
  const wait = Math.ceil(passwordFails.retryAfterMs(key) / 1000);
  if (wait > 0) return tooManyAttempts(wait, retryText(wait));
  let ok: boolean;
  if ("recoveryCode" in proof) {
    const i = u.recoveryCodes.indexOf(hashRecoveryCode(proof.recoveryCode));
    ok = i >= 0;
    if (ok) u.recoveryCodes.splice(i, 1);
  } else if (u.isLdap) {
    const dir = db().ldapDirectory.get(u.id);
    ok = dir !== undefined && secureEquals(proof.password, dir);
  } else ok = !!u.passwordHash && verifyPassword(proof.password, u.passwordHash);
  if (!ok) {
    passwordFails.fail(key);
    // 400, not 401: a 401 would make the browser think the session ended
    return "recoveryCode" in proof
      ? apiError(400, "invalid_code", "That recovery code didn't match or was already used. Check it and try again.")
      : apiError(400, "invalid_credentials", "The current password is wrong. Check it and try again.");
  }
  passwordFails.succeed(key);
  return null;
}
