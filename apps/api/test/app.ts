// Helpers for route tests: the app, a request with the internal token, demo data and a session without the sign-in route.
import { createApp } from "../src/app";
import { verifyPassword } from "../src/auth/password";
import { createSession } from "../src/auth/sessions";
import { sql } from "../src/db/client";
import { seedDemo } from "../src/seed/demo";
import { seedSystem } from "../src/seed/system";
import { truncateAll } from "./db";

/** A new app instance. */
export const api = () => createApp();

let shared: ReturnType<typeof createApp> | undefined;

/** One request to the shared app with X-Internal-Token; `token` → `Authorization: Bearer`, `body` → JSON. */
export function call(method: string, path: string, o: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return (shared ??= createApp()).request(path, {
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
  await seedSystem(sql, {});
  await seedDemo(sql);
}

/** A session token for a demo account (username or email), straight through createSession. */
export async function signIn(login: string, password = "Password123!"): Promise<string> {
  const [u] = await sql`select id, password_hash from users where lower(username) = lower(${login}) or lower(email) = lower(${login})`;
  if (!u || !(await verifyPassword(password, u.password_hash))) throw new Error(`signIn: wrong login or password for ${login}`);
  const s = await sql.begin((tx) => createSession(tx, { userId: u.id, method: "password", client: { ip: "127.0.0.1", ua: "bun test" } }));
  return s.token;
}
