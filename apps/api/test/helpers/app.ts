// Helpers for route tests: the app, a request with the internal token, demo data and a session without the sign-in route.
import { eq, or, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { seedDemo } from "../../src/db/seed/demo";
import { seedSystem } from "../../src/db/seed/system";
import { db } from "../../src/kernel/db";
import { createSession, verifyPassword } from "../../src/modules/auth";
import { users } from "../../src/modules/users";
import { truncateAll } from "./db";

/** A new app instance. */
export const api = () => createApp();

/** One request to `app` (path on this host), as Bun.serve would hand it over. */
export const request = (app: { handle: (r: Request) => Promise<Response> }, path: string, init?: RequestInit): Promise<Response> =>
  app.handle(new Request(new URL(path, "http://localhost").href, init));

let shared: ReturnType<typeof createApp> | undefined;

/** One request to the shared app with X-Internal-Token; `token` → `Authorization: Bearer`, `body` → JSON. */
export function call(method: string, path: string, o: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return request((shared ??= createApp()), path, {
    method,
    headers: {
      "X-Internal-Token": process.env.INTERNAL_API_TOKEN!,
      ...(o.token && { Authorization: `Bearer ${o.token}` }),
      ...(o.body !== undefined && { "Content-Type": "application/json" }),
      ...o.headers,
    },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
}

/** Empty database, then the system and demo seeds (no superadmin from env). */
export async function resetData(): Promise<void> {
  await truncateAll();
  await seedSystem(db, {});
  await seedDemo(db);
}

/** A session token for a demo account (username or email), straight through createSession. */
export async function signIn(login: string, password = "Password123!"): Promise<string> {
  const key = login.toLowerCase();
  const [u] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users)
    .where(or(eq(sql`lower(${users.username})`, key), eq(sql`lower(${users.email})`, key)));
  if (!u || !(await verifyPassword(password, u.passwordHash))) throw new Error(`signIn: wrong login or password for ${login}`);
  const s = await db.transaction((tx) => createSession(tx, { userId: u.id, method: "password", client: { ip: "127.0.0.1", ua: "bun test" } }));
  return s.token;
}
