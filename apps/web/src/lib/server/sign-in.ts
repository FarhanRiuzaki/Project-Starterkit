import "server-only";
import { randomUUID } from "node:crypto";
import type { IronSession } from "iron-session";
import type { AuthLogDto } from "@/lib/shared/contracts/audit";
import type { AuthMethod } from "@/lib/shared/contracts/auth";
import { clientIp } from "./api";
import { recordAuth } from "./audit";
import { newCsrfToken } from "./csrf";
import { db, type UserRecord } from "./mock/db";
import type { AppSession } from "./session";

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
  const now = new Date().toISOString();
  const sid = randomUUID();
  sessions.set(sid, { id: sid, userId: user.id, method, ...origin(req), createdAt: now, lastSeenAt: now });
  s.sid = sid;
  s.csrf = newCsrfToken();
  s.pending2fa = undefined;
  await s.save();
  user.lastLoginAt = now;
}
