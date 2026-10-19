import { randomUUID } from "node:crypto";
import { sealData } from "iron-session";
import { db, type UserRecord } from "@/lib/server/mock/db";
import { SESSION_COOKIE } from "@/lib/server/session";

/** CSRF token the helper seals into the cookie; send it as `x-csrf-token` on mutations. */
export const TEST_CSRF = "c".repeat(43);

/**
 * Route tests: sign `username` in by adding a store session and sealing `{ sid, csrf }` into `jar`, the Map behind the
 * test file's `vi.mock("next/headers")` cookie store. `process.env.SESSION_SECRET` must be set (vi.hoisted) first.
 */
export async function signInAs(jar: Map<string, string>, username: string): Promise<UserRecord> {
  const user = [...db().users.values()].find((u) => u.username === username);
  if (!user) throw new Error(`signInAs: no user "${username}"`);
  const sid = randomUUID();
  const now = new Date().toISOString();
  db().sessions.set(sid, { id: sid, userId: user.id, method: "password", device: "test", ip: "test", createdAt: now, lastSeenAt: now });
  jar.set(SESSION_COOKIE, await sealData({ sid, csrf: TEST_CSRF }, { password: process.env.SESSION_SECRET!, ttl: 3600 }));
  return user;
}
