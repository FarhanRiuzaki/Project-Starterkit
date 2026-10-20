import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { AuthMethod } from "@starterkit/shared/contracts/auth";
import type { PermissionName } from "@starterkit/shared/permissions";
import { type Config, config } from "./config";
import { db, type SessionRecord, type UserRecord } from "./mock/db";
import { effectivePermissions } from "./mock/rules";

export const SESSION_COOKIE = "sk_session";

/**
 * The sealed cookie holds only pointers: `sid` = key into db().sessions (user, device, IP, times live there),
 * `csrf` = mutation token, `pending2fa` = password passed, second factor not yet. Permissions are never stored here.
 */
export type AppSession = { sid?: string; csrf?: string; pending2fa?: { userId: string; method: AuthMethod; at: number } };

/** A password-passed sign-in waits this long for its second factor. */
export const PENDING_2FA_TTL_MS = 10 * 60_000;

/** The pending second-factor step when it is still within PENDING_2FA_TTL_MS (`at` = when the password passed). */
export function pending2faOf(s: AppSession, now = Date.now()): AppSession["pending2fa"] | null {
  const p = s.pending2fa;
  return p && now - p.at <= PENDING_2FA_TTL_MS ? p : null; // a missing `at` gives NaN: expired
}

/** The signed-in user of one request, read fresh from the store. */
export type AuthCtx = { user: UserRecord; sid: string; perms: Set<PermissionName> };

export function sessionOptions(c: Config = config()): SessionOptions {
  return {
    password: c.SESSION_SECRET,
    cookieName: SESSION_COOKIE,
    ttl: c.SESSION_TTL_HOURS * 3600,
    cookieOptions: { httpOnly: true, sameSite: "strict", secure: c.COOKIE_SECURE, path: "/" },
  };
}

export async function getSession() {
  return getIronSession<AppSession>(await cookies(), sessionOptions());
}

/** lastSeenAt is written at most this often (one store write per minute per session, not one per request). */
export const LAST_SEEN_EVERY_MS = 60_000;

/** A new store session (sign-in): lasts SESSION_TTL_HOURS from now at most. */
export function newSessionRecord(id: string, userId: string, method: AuthMethod, origin: { device: string; ip: string }, now = Date.now(), c: Config = config()): SessionRecord {
  const at = new Date(now).toISOString();
  return { id, userId, method, ...origin, createdAt: at, lastSeenAt: at, expiresAt: new Date(now + c.SESSION_TTL_HOURS * 3_600_000).toISOString() };
}

/** Before its absolute end and seen within SESSION_IDLE_MINUTES. */
export function sessionLive(rec: SessionRecord, now = Date.now(), c: Config = config()): boolean {
  return now < Date.parse(rec.expiresAt) && now - Date.parse(rec.lastSeenAt) <= c.SESSION_IDLE_MINUTES * 60_000;
}

/** Drops ended sessions from the store; reads that list or count sessions call it first. */
// ponytail: full scan per read, fine for the in-memory mock; a database expires rows with a WHERE on expires_at/last_seen_at.
export function pruneSessions(now = Date.now()): void {
  for (const [id, rec] of db().sessions) if (!sessionLive(rec, now)) db().sessions.delete(id);
}

/**
 * The user behind a session, or null: no sid or csrf, second factor still pending, the sid ended in the store
 * (sign-out, terminated), the session expired or went idle (its record is removed), or the user is gone or inactive.
 * A live session is marked seen (lastSeenAt, at most once per LAST_SEEN_EVERY_MS); every caller (API guard, page
 * guard, prefetch) goes through here, so any request keeps it alive. Permissions are computed from the current roles.
 */
export function authOf(s: AppSession, now = Date.now()): AuthCtx | null {
  if (!s.sid || !s.csrf || s.pending2fa) return null;
  const store = db();
  const rec = store.sessions.get(s.sid);
  if (!rec) return null;
  if (!sessionLive(rec, now)) {
    store.sessions.delete(rec.id);
    return null;
  }
  const user = store.users.get(rec.userId);
  if (!user?.isActive) return null;
  if (now - Date.parse(rec.lastSeenAt) >= LAST_SEEN_EVERY_MS) rec.lastSeenAt = new Date(now).toISOString();
  return { user, sid: s.sid, perms: effectivePermissions(user, store.roles) };
}
