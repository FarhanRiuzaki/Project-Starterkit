import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { AuthMethod } from "@/lib/shared/contracts/auth";
import type { PermissionName } from "@/lib/shared/permissions";
import { type Config, config } from "./config";
import { db, type UserRecord } from "./mock/db";
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

/**
 * The user behind a session, or null: no sid or csrf, second factor still pending, the sid ended in the store
 * (sign-out, terminated), or the user is gone or inactive. Permissions are computed from the current roles.
 */
export function authOf(s: AppSession): AuthCtx | null {
  if (!s.sid || !s.csrf || s.pending2fa) return null;
  const store = db();
  const rec = store.sessions.get(s.sid);
  const user = rec ? store.users.get(rec.userId) : undefined;
  if (!user?.isActive) return null;
  return { user, sid: s.sid, perms: effectivePermissions(user, store.roles) };
}
