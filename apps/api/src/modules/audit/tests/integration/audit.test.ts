// Port of apps/web/src/app/api/audit/audit-routes.test.ts against /v1/audit/*, test for test with the same names.
// Differences: ids are UUIDs (looked up by username); sessions come from signIn(); the mock store's rows are Drizzle inserts.
// New: "capped count on 200k rows" (deep page of a big table), filters through the actor's current email on real rows.
import { beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import type { ActivityDto, AuthLogDto } from "@starterkit/shared/contracts/audit";
import type { Page } from "@starterkit/shared/contracts/common";
import { appDate, shiftDate } from "@starterkit/ui/lib/format";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { call, resetData, signIn } from "../../../../../test/helpers/app";
import { db } from "../../../../kernel/db";
import { rolePermissions, roles } from "../../../rbac";
import { users } from "../../../users";
import { activity as activityTable, authLog } from "../../schema";

const activity = (token: string | undefined, qs = "") => call("GET", `/v1/audit/activity${qs ? `?${qs}` : ""}`, { token });
const auth = (token: string | undefined, qs = "") => call("GET", `/v1/audit/auth${qs ? `?${qs}` : ""}`, { token });
const page = async <T,>(r: Response) => { expect(r.status).toBe(200); return (await r.json()) as Page<T>; };
const idOf = async (username: string): Promise<string> => (await db.select({ id: users.id }).from(users).where(eq(users.username, username)))[0]!.id;
const count = async (table: "activity" | "auth_log"): Promise<number> => db.$count(table === "activity" ? activityTable : authLog);

type Act = Partial<Omit<ActivityDto, "id" | "at">> & { actorId?: string };
/** Replaces the whole activity log with `rows`. Defaults: Super Admin updated user Viewer User. */
async function setActivity(rows: (Act & { id: string; at: string })[]) {
  const superId = await idOf("superadmin"), viewerId = await idOf("viewer");
  await db.delete(activityTable);
  for (const r of rows) {
    const actor = r.actor ?? { id: superId, name: "Super Admin" };
    const t = r.target ?? { type: "user", id: viewerId, label: "Viewer User" };
    await db.insert(activityTable).values({
      id: r.id, at: new Date(r.at), actorId: actor.id, actorName: actor.name, action: r.action ?? "user.update",
      targetType: t.type, targetId: t.id, targetLabel: t.label, before: r.before ?? null, after: r.after ?? null,
    });
  }
}
/** Replaces the whole sign-in log with `rows`. Defaults: the viewer signed in with a password. */
async function setAuthLog(rows: (Partial<Omit<AuthLogDto, "id" | "at">> & { id: string; at: string })[]) {
  const viewerId = await idOf("viewer");
  await db.delete(authLog);
  for (const r of rows) {
    await db.insert(authLog).values({
      id: r.id, at: new Date(r.at), event: r.event ?? "login_success", login: r.login ?? "viewer@example.com", userId: r.userId === undefined ? viewerId : r.userId,
      method: r.method ?? "password", ip: r.ip ?? "10.0.0.1", device: r.device ?? "Chrome on macOS", location: r.location ?? null,
    });
  }
}
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** A custom role holding everything the viewer has except audit.view. */
async function dropAuditView() {
  await db.delete(rolePermissions)
    .where(and(eq(rolePermissions.permission, "audit.view"), inArray(rolePermissions.roleId, db.select({ id: roles.id }).from(roles).where(eq(roles.name, "Viewer")))));
}

beforeEach(async () => {
  setSystemTime();
  await resetData();
});

describe.each([["activity", activity], ["auth", auth]] as const)("GET /api/audit/%s: query", (_, get) => {
  it.each([
    ["from=2026-10-10&to=2026-10-09", "to before from"],
    ["from=2026-01-01&to=2026-04-03", "93 days"],
    ["from=2026-10-01", "from without to"],
    ["to=2026-10-01", "to without from"],
    ["from=2026-02-30&to=2026-03-01", "not a calendar date"],
    ["from=2026-10-01T00:00:00Z&to=2026-10-02", "a datetime"],
    ["page=0", "page 0"],
    ["page=1001", "past the last servable page"],
    ["pageSize=10", "page size outside 15/25/50/100"],
    ["sort=password", "sort key outside the whitelist"],
    ["format=xlsx", "unknown format"],
  ])("%s (%s) is 400 before the guard", async (qs) => {
    expect((await get(undefined, qs)).status).toBe(400); // no session: a 401 would mean the guard ran first
    const token = await signIn("viewer");
    const r = await get(token, qs);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("bad_request");
  });

  it("92 days inclusive is allowed", async () => {
    const token = await signIn("viewer");
    expect((await get(token, "from=2026-01-01&to=2026-04-02")).status).toBe(200);
  });

  it("needs a session, then audit.view (a custom role without it is 403, JSON and CSV alike)", async () => {
    expect((await get(undefined)).status).toBe(401);
    await dropAuditView();
    const token = await signIn("viewer");
    expect((await get(token)).status).toBe(403);
    expect((await get(token, "format=csv")).status).toBe(403);
  });
});

describe("GET /api/audit/activity", () => {
  it("pages newest first by default (15 rows), with the total of the whole log", async () => {
    const token = await signIn("viewer");
    const body = await page<ActivityDto>(await activity(token));
    expect(body).toMatchObject({ total: await count("activity"), page: 1, pageSize: 15 });
    expect(body.items).toHaveLength(15);
    const ats = body.items.map((e) => e.at);
    expect(ats).toEqual([...ats].sort().reverse());
    const two = await page<ActivityDto>(await activity(token, "page=2&pageSize=25&sort=at"));
    const all = await db.select({ at: activityTable.at }).from(activityTable).orderBy(asc(activityTable.at), asc(activityTable.id));
    expect(two.items.map((e) => e.at)).toEqual(all.map((e) => e.at.toISOString()).slice(25, 50));
  });

  it("filters by user (actor name, case-insensitive), action, and a WIB calendar range", async () => {
    const adminId = await idOf("admin");
    await setActivity([
      { id: uuid(1), at: "2026-10-10T16:59:59.000Z" }, // 23:59:59 WIB on 10 Oct
      { id: uuid(2), at: "2026-10-10T17:00:00.000Z" }, // 00:00 WIB on 11 Oct
      { id: uuid(3), at: "2026-10-09T17:00:00.000Z", action: "role.update" }, // 00:00 WIB on 10 Oct
      { id: uuid(4), at: "2026-10-10T10:00:00.000Z", actor: { id: adminId, name: "Admin User" } },
    ]);
    const token = await signIn("viewer");
    const ids = async (qs: string) => (await page<ActivityDto>(await activity(token, qs))).items.map((e) => e.id);
    expect(await ids("from=2026-10-10&to=2026-10-10")).toEqual([uuid(1), uuid(4), uuid(3)]);
    expect(await ids("from=2026-10-11&to=2026-10-11")).toEqual([uuid(2)]);
    expect(await ids("action=role.update")).toEqual([uuid(3)]);
    expect(await ids("user=admin%20user")).toEqual([uuid(4)]);
    // the actor's current email (looked up by id at query time): superadmin@example.com
    expect(await ids("user=SUPERADMIN%40example")).toEqual([uuid(2), uuid(1), uuid(3)]);
    await db.update(users).set({ email: "renamed@example.org" }).where(eq(users.id, adminId));
    expect(await ids("user=renamed%40example.org")).toEqual([uuid(4)]);
    expect(await ids("user=SUPER&action=user.update&from=2026-10-10&to=2026-10-10")).toEqual([uuid(1)]);
    // the id as recorded, and a wildcard typed by the user stays literal
    expect(await ids(`user=${adminId}`)).toEqual([uuid(4)]);
    expect(await ids("user=%25")).toEqual([]);
  });

  it("an admin password reset is logged without the password, in JSON and CSV", async () => {
    const token = await signIn("admin");
    const viewerId = await idOf("viewer");
    const res = await call("POST", `/v1/users/${viewerId}/reset-password`, { token });
    const { temporaryPassword } = (await res.json()) as { temporaryPassword: string };
    expect(temporaryPassword.length).toBeGreaterThan(0);
    const body = await page<ActivityDto>(await activity(token, "action=user.reset_password"));
    expect(body.total).toBeGreaterThanOrEqual(1);
    const mine = body.items.find((e) => e.target.id === viewerId)!;
    expect(mine.before).toBeNull();
    expect(mine.after).toBeNull();
    expect(JSON.stringify(body)).not.toContain(temporaryPassword);
    expect(await (await activity(token, "format=csv")).text()).not.toContain(temporaryPassword);
  });

  it("CSV: attachment named activity-<WIB date>.csv, no-store, BOM, newest first, formula cells neutralised, same filters", async () => {
    const token = await signIn("viewer");
    setSystemTime(new Date(Date.UTC(2026, 9, 19, 17, 30))); // 20 Oct in WIB
    try {
      await setActivity([
        { id: uuid(1), at: "2026-10-18T01:00:00.000Z", target: { type: "user", id: "u-9", label: '=HYPERLINK("http://evil.example","click")' } },
        { id: uuid(2), at: "2026-10-19T01:00:00.000Z", before: { name: "Old" }, after: { name: "New" } },
        { id: uuid(3), at: "2026-10-19T02:00:00.000Z", action: "role.delete" },
      ]);
      const r = await activity(token, "format=csv&action=user.update&pageSize=15&page=1");
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toMatch(/^text\/csv; ?charset=utf-8$/);
      expect(r.headers.get("content-disposition")).toBe('attachment; filename="activity-2026-10-20.csv"');
      expect(r.headers.get("cache-control")).toBe("no-store");
      const raw = new Uint8Array(await r.clone().arrayBuffer());
      expect([...raw.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const lines = (await r.text()).replace(/^﻿/, "").trimEnd().split("\r\n");
      expect(lines).toHaveLength(3); // header + x2 + x1 (x3 filtered out)
      expect(lines[1]).toContain("2026-10-19T01:00:00.000Z");
      expect(lines[1]).toContain("name: Old → New");
      expect(lines[2]).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
      expect(lines.join("\n")).not.toMatch(/,=HYPERLINK|,"=HYPERLINK/);
    } finally {
      setSystemTime();
    }
  });

  const bulk = () => db.insert(activityTable).select(db.select({
    id: sql`gen_random_uuid()`.as("id"), at: sql`now() - g * interval '1 second'`.as("at"), actorId: sql`null`.as("actorId"), actorName: sql`'Bulk'`.as("actorName"), action: sql`'user.update'`.as("action"),
    targetType: sql`'user'`.as("targetType"), targetId: sql`'x'`.as("targetId"), targetLabel: sql`'x'`.as("targetLabel"), before: sql`null`.as("before"), after: sql`null`.as("after"),
  }).from(sql`generate_series(1, 200000) g`));

  it("capped count on 200k rows, filtered by user over the 92-day range", async () => {
    const token = await signIn("viewer");
    try {
      await bulk();
      const to = appDate(Date.now());
      for (const [user, total] of [["zzz", 0], ["bul", 100_000]] as const) { // no row matches (full scan) / every row matches (capped)
        const t0 = performance.now();
        const r = await activity(token, `user=${user}&from=${shiftDate(to, -91)}&to=${to}&page=1000&pageSize=100`);
        const ms = performance.now() - t0;
        console.log(`filtered user=${user}, 92 days, 200k rows: answered ${r.status} in ${ms.toFixed(0)} ms`);
        expect(r.status).toBe(200);
        expect(((await r.json()) as Page<ActivityDto>).total).toBe(total);
        expect(ms).toBeLessThan(5000); // the statement timeout: documents the ceiling, not a target
      }
    } finally {
      await db.delete(activityTable);
    }
  });

  it("capped count on 200k rows", async () => {
    const token = await signIn("viewer");
    try {
      await bulk();
      const t0 = performance.now();
      const r = await activity(token, "page=1000&pageSize=100");
      const ms = performance.now() - t0;
      console.log(`capped count on 200k rows: page=1000&pageSize=100 answered ${r.status} in ${ms.toFixed(0)} ms`);
      expect(r.status).toBe(200);
      const body = (await r.json()) as Page<ActivityDto>;
      expect(body).toMatchObject({ total: 100_000, totalCapped: true, page: 1000, pageSize: 100 });
      expect(body.items).toHaveLength(100);
      expect(ms).toBeLessThan(2000);
    } finally {
      await db.delete(activityTable);
    }
  });
});

describe("GET /api/audit/auth", () => {
  it("event=login_failed returns only failed sign-ins, all of them", async () => {
    const token = await signIn("viewer");
    const expected = await db.$count(authLog, eq(authLog.event, "login_failed"));
    expect(expected).toBeGreaterThan(0);
    const body = await page<AuthLogDto>(await auth(token, "event=login_failed&pageSize=100"));
    expect(body.total).toBe(expected);
    expect(body.items.every((e) => e.event === "login_failed")).toBe(true);
  });

  it("filters by method and by user (login), newest first", async () => {
    await setAuthLog([
      { id: uuid(1), at: "2026-10-10T01:00:00.000Z" },
      { id: uuid(2), at: "2026-10-11T01:00:00.000Z", method: "google", login: "google@example.com" },
      { id: uuid(3), at: "2026-10-12T01:00:00.000Z", event: "login_failed", userId: null, login: "nobody@example.com" },
    ]);
    const token = await signIn("viewer");
    const ids = async (qs: string) => (await page<AuthLogDto>(await auth(token, qs))).items.map((e) => e.id);
    expect(await ids("")).toEqual([uuid(3), uuid(2), uuid(1)]);
    expect(await ids("method=google")).toEqual([uuid(2)]);
    expect(await ids("user=NOBODY")).toEqual([uuid(3)]);
    // the user's current email, and the user id
    await db.update(users).set({ email: "moved@example.org" }).where(eq(users.username, "viewer"));
    expect(await ids("user=moved%40example")).toEqual([uuid(2), uuid(1)]);
    expect(await ids(`user=${await idOf("viewer")}`)).toEqual([uuid(2), uuid(1)]);
  });

  it("CSV is named sign-in-<date>.csv and stops at 10,000 rows, newest first", async () => {
    await setAuthLog([]);
    const start = Date.UTC(2026, 8, 1);
    await db.insert(authLog).select(db.select({
      id: sql`gen_random_uuid()`.as("id"), at: sql`${new Date(start).toISOString()}::timestamptz + g * interval '1 minute'`.as("at"), event: sql`'login_success'`.as("event"),
      login: sql`'viewer@example.com'`.as("login"), userId: sql`null`.as("userId"), method: sql`'password'`.as("method"), ip: sql`'10.0.0.1'`.as("ip"), device: sql`'Chrome on macOS'`.as("device"), location: sql`null`.as("location"),
    }).from(sql`generate_series(0, 10049) g`));
    const token = await signIn("viewer");
    const r = await auth(token, "format=csv");
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="sign-in-\d{4}-\d{2}-\d{2}\.csv"$/);
    const lines = (await r.text()).trimEnd().split("\r\n");
    expect(lines).toHaveLength(10_001);
    expect(lines[1]).toContain(new Date(start + 10_049 * 60_000).toISOString());
  });
});

describe("audit entries from real actions", () => {
  it("a user edit shows up first in the activity log with its before/after", async () => {
    const token = await signIn("admin");
    const viewerId = await idOf("viewer");
    expect((await call("PATCH", `/v1/users/${viewerId}`, { token, body: { name: "Renamed Viewer" } })).status).toBe(200);
    const top = (await page<ActivityDto>(await activity(token))).items[0]!;
    expect(top).toMatchObject({ action: "user.update", target: { id: viewerId } });
    expect(top.after).toMatchObject({ name: "Renamed Viewer" });
  });
});
