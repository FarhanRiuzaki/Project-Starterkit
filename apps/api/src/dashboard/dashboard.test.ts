// Port of apps/web/src/app/api/dashboard/dashboard-route.test.ts against /v1/dashboard, test for test with the same names.
// Differences: rows are SQL inserts; only `Date` is faked (the database clock stays real, sessions are fresh anyway);
// "an expired or idle session is not counted and leaves the store" checks the count only: the API filters ended
// sessions (like sessionPage) and does not delete them in a GET.
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import type { AuthLogDto } from "@starterkit/shared/contracts/audit";
import type { DashboardDto } from "@starterkit/shared/contracts/dashboard";
import { call, resetData, signIn } from "../../test/app";
import { createSession } from "../auth/sessions";
import { sql } from "../db/client";

// 20 Oct 2026, 00:30 WIB (UTC+7): early in the day, so "today" in WIB differs from the UTC date.
const NOW = Date.UTC(2026, 9, 19, 17, 30);
const HOUR = 3_600_000;
const get = (token?: string) => call("GET", "/v1/dashboard", { token });
const body = async (token: string) => { const r = await get(token); expect(r.status).toBe(200); return (await r.json()) as DashboardDto; };
const idOf = async (username: string): Promise<string> => (await sql`select id from users where username = ${username}`)[0].id;
/** Replaces the whole sign-in log with `rows` (event at ms). */
async function setAuthLog(rows: [id: number, at: number, event: AuthLogDto["event"]][]) {
  await sql`truncate auth_log`;
  for (const [n, at, event] of rows) {
    await sql`insert into auth_log (id, at, event, login, user_id, method, ip, device)
      values (${`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`}, ${new Date(at)}, ${event}, 'x@example.com', null, 'password', '10.0.0.1', 'test')`;
  }
}
/** `role` holds exactly `perms`. */
async function setPerms(role: string, perms: string[]) {
  const [{ id }] = await sql`select id from roles where name = ${role}`;
  await sql`delete from role_permissions where role_id = ${id}`;
  if (perms.length) await sql`insert into role_permissions ${sql(perms.map((permission) => ({ role_id: id, permission })))}`;
}
const addSession = async (userId: string): Promise<string> =>
  (await sql.begin((tx) => createSession(tx, { userId, method: "password", client: { ip: "10.0.0.9", ua: "bun test" } }))).id;

beforeEach(async () => {
  await resetData();
  setSystemTime(new Date(NOW));
});
afterEach(() => setSystemTime());

describe("GET /api/dashboard", () => {
  it("needs a session (any signed-in user, no permission)", async () => {
    expect((await get()).status).toBe(401);
    await setPerms("Viewer", []);
    expect((await get(await signIn("viewer"))).status).toBe(200);
  });

  it("without audit.view: recent, failedLogins24h and every day's failed count are null, the rest is filled", async () => {
    await setPerms("Viewer", ["user.view"]);
    const b = await body(await signIn("viewer"));
    expect(b.recent).toBeNull();
    expect(b.failedLogins24h).toBeNull();
    expect(b.activeUsers).toBeGreaterThan(0);
    expect(b.loginsPerDay).toHaveLength(14);
    expect(b.loginsPerDay.every((d) => d.failed === null && typeof d.success === "number")).toBe(true);
  });

  it("with audit.view: the 5 newest activity entries and the failed sign-ins of the last 24 hours", async () => {
    await setAuthLog([
      [1, NOW - 1 * HOUR, "login_failed"], [2, NOW - 23 * HOUR, "login_failed"], [3, NOW - 25 * HOUR, "login_failed"],
      [4, NOW - 2 * HOUR, "login_success"], [5, NOW - HOUR, "2fa_failed"],
    ]);
    const b = await body(await signIn("viewer"));
    expect(b.failedLogins24h).toBe(2);
    expect(b.recent).toHaveLength(5);
    const newest: { at: Date }[] = await sql`select at from activity order by at desc, id desc limit 5`;
    expect(b.recent!.map((e) => e.at)).toEqual(newest.map((e) => e.at.toISOString()));
  });

  it("loginsPerDay: 14 consecutive WIB days ending today, oldest first, empty days are 0", async () => {
    const wibMidnight = Date.UTC(2026, 9, 19, 17, 0); // 00:00 WIB on 20 Oct
    await setAuthLog([
      [1, wibMidnight + 10 * 60_000, "login_success"], // today
      [2, wibMidnight - 1, "login_success"], // 23:59:59.999 WIB on 19 Oct
      [3, wibMidnight - 3 * 24 * HOUR, "login_failed"], // 17 Oct
      [4, wibMidnight - 3 * 24 * HOUR + HOUR, "login_failed"],
      [5, wibMidnight - 13 * 24 * HOUR, "login_success"], // 7 Oct, the first day shown
      [6, wibMidnight - 14 * 24 * HOUR, "login_success"], // 6 Oct: outside
      [7, wibMidnight - 2 * HOUR, "logout"], // not a sign-in
    ]);
    const days = (await body(await signIn("viewer"))).loginsPerDay;
    expect(days.map((d) => d.date)).toEqual(Array.from({ length: 14 }, (_, i) => `2026-10-${String(7 + i).padStart(2, "0")}`));
    const at = (date: string) => days.find((d) => d.date === date);
    expect(at("2026-10-20")).toEqual({ date: "2026-10-20", success: 1, failed: 0 });
    expect(at("2026-10-19")).toEqual({ date: "2026-10-19", success: 1, failed: 0 });
    expect(at("2026-10-17")).toEqual({ date: "2026-10-17", success: 0, failed: 2 });
    expect(at("2026-10-07")).toEqual({ date: "2026-10-07", success: 1, failed: 0 });
    expect(days.reduce((n, d) => n + d.success + (d.failed ?? 0), 0)).toBe(5);
  });

  it("counts active users, users created in the last 7 days, and live sessions of active users", async () => {
    await sql`update users set created_at = ${new Date(NOW - 2 * 24 * HOUR)} where username = 'admin'`;
    await sql`update users set created_at = ${new Date(NOW - 8 * 24 * HOUR)} where username = 'twofa'`;
    await signIn("viewer");
    await addSession(await idOf("inactive")); // a session of an inactive user is not counted
    const b = await body(await signIn("viewer"));
    const [{ active }] = await sql`select count(*)::int as active from users where is_active`;
    const [{ fresh }] = await sql`select count(*)::int as fresh from users where created_at >= ${new Date(NOW - 7 * 24 * HOUR)}`;
    expect(b.activeUsers).toBe(active);
    expect(b.newUsers7d).toBe(fresh);
    expect(b.newUsers7d).toBeGreaterThanOrEqual(1);
    expect(b.activeSessions).toBe(2); // the two viewer sign-ins above
  });
});

describe("dashboard sign-in counts and sessions", () => {
  it("success counts only full sign-ins (login_success, 2fa_success), not a password step waiting for its code", async () => {
    const m = NOW - 10 * 60_000; // today in the app time zone
    await setAuthLog([[1, m, "password_ok"], [2, m, "2fa_success"], [3, m, "login_success"], [4, m, "password_reset"]]);
    const b = await body(await signIn("viewer"));
    expect(b.loginsPerDay.at(-1)!.success).toBe(2);
  });

  it("an expired or idle session is not counted and leaves the store", async () => {
    const token = await signIn("viewer");
    const n = (await body(token)).activeSessions;
    const adminId = await idOf("admin");
    const expired = await addSession(adminId), idle = await addSession(adminId);
    await sql`update sessions set expires_at = now() - interval '1 millisecond' where id = ${expired}`;
    await sql`update sessions set last_seen_at = now() - interval '121 minutes' where id = ${idle}`;
    expect((await body(token)).activeSessions).toBe(n);
  });
});
