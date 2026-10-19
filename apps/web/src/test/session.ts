import { randomUUID } from "node:crypto";
import { sealData } from "iron-session";
import { db, type SessionRecord, type UserRecord } from "@/lib/server/mock/db";
import { newSessionRecord, SESSION_COOKIE } from "@/lib/server/session";

/** CSRF token the helper seals into the cookie; send it as `x-csrf-token` on mutations. */
export const TEST_CSRF = "c".repeat(43);

/** Another store session of `userId` (a second browser), built like a real sign-in; `over` changes fields. Returns its id. */
export function addSession(userId: string, over: Partial<SessionRecord> = {}): string {
  const rec = { ...newSessionRecord(over.id ?? randomUUID(), userId, "password", { device: "other", ip: "1.1.1.1" }), ...over };
  db().sessions.set(rec.id, rec);
  return rec.id;
}

/**
 * Route tests: sign `username` in by adding a store session and sealing `{ sid, csrf, ...cookie }` into `jar`, the Map
 * behind the test file's `vi.mock("next/headers")` cookie store. `process.env.SESSION_SECRET` must be set (vi.hoisted)
 * first. `cookie` adds or overrides session fields (e.g. `pending2fa`).
 */
export async function signInAs(jar: Map<string, string>, username: string, cookie: Record<string, unknown> = {}): Promise<{ user: UserRecord; sid: string }> {
  const user = [...db().users.values()].find((u) => u.username === username);
  if (!user) throw new Error(`signInAs: no user "${username}"`);
  const sid = addSession(user.id, { device: "test", ip: "test" });
  jar.set(SESSION_COOKIE, await sealData({ sid, csrf: TEST_CSRF, ...cookie }, { password: process.env.SESSION_SECRET!, ttl: 24 * 3600 }));
  return { user, sid };
}
