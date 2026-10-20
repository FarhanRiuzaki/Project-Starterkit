// Port of apps/web/src/app/api/audit/audit-routes.test.ts against /v1/audit/*, test for test with the same names.
// Differences: ids are UUIDs (looked up by username); sessions come from signIn(); the mock store's rows are SQL inserts.
// New: "capped count on 200k rows" (deep page of a big table), filters through the actor's current email on real rows.
import { beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import type { ActivityDto, AuthLogDto } from "@starterkit/shared/contracts/audit";
import type { Page } from "@starterkit/shared/contracts/common";
import { call, resetData, signIn } from "../../test/app";
import { appDate, shiftDate } from "@starterkit/ui/lib/format";
import { sql } from "../db/client";

const activity = (token: string | undefined, qs = "") => call("GET", `/v1/audit/activity${qs ? `?${qs}` : ""}`, { token });
const auth = (token: string | undefined, qs = "") => call("GET", `/v1/audit/auth${qs ? `?${qs}` : ""}`, { token });
const page = async <T,>(r: Response) => { expect(r.status).toBe(200); return (await r.json()) as Page<T>; };
const idOf = async (username: string): Promise<string> => (await sql`select id from users where username = ${username}`)[0].id;
const count = async (table: "activity" | "auth_log"): Promise<number> => (await sql.unsafe(`select count(*)::int as n from ${table}`))[0].n;

type Act = Partial<Omit<ActivityDto, "id" | "at">> & { actorId?: string };
/** Replaces the whole activity log with `rows`. Defaults: Super Admin updated user Viewer User. */
async function setActivity(rows: (Act & { id: string; at: string })[]) {
  const superId = await idOf("superadmin"), viewerId = await idOf("viewer");
  await sql`truncate activity`;
  for (const r of rows) {
    const actor = r.actor ?? { id: superId, name: "Super Admin" };
    const t = r.target ?? { type: "user", id: viewerId, label: "Viewer User" };
    await sql`insert into activity (id, at, actor_id, actor_name, action, target_type, target_id, target_label, before, after)
      values (${r.id}, ${r.at}, ${actor.id}, ${actor.name}, ${r.action ?? "user.update"}, ${t.type}, ${t.id}, ${t.label},
        ${r.before == null ? null : JSON.stringify(r.before)}::text::jsonb, ${r.after == null ? null : JSON.stringify(r.after)}::text::jsonb)`;
  }
}
/** Replaces the whole sign-in log with `rows`. Defaults: the viewer signed in with a password. */
async function setAuthLog(rows: (Partial<Omit<AuthLogDto, "id" | "at">> & { id: string; at: string })[]) {
  const viewerId = await idOf("viewer");
  await sql`truncate auth_log`;
  for (const r of rows) {
    await sql`insert into auth_log (id, at, event, login, user_id, method, ip, device, location)
      values (${r.id}, ${r.at}, ${r.event ?? "login_success"}, ${r.login ?? "viewer@example.com"}, ${r.userId === undefined ? viewerId : r.userId},
        ${r.method ?? "password"}, ${r.ip ?? "10.0.0.1"}, ${r.device ?? "Chrome on macOS"}, ${r.location ?? null})`;
  }
}
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** A custom role holding everything the viewer has except audit.view. */
async function dropAuditView() {
  await sql`delete from role_permissions where permission = 'audit.view' and role_id = (select id from roles where name = 'Viewer')`;
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
    const all: { at: Date }[] = await sql`select at from activity order by at, id`;
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
    await sql`update users set email = 'renamed@example.org' where id = ${adminId}`;
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

  const bulk = () => sql`insert into activity (id, at, actor_id, actor_name, action, target_type, target_id, target_label)
    select gen_random_uuid(), now() - g * interval '1 second', null, 'Bulk', 'user.update', 'user', 'x', 'x' from generate_series(1, 200000) g`;

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
      await sql`truncate activity`;
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
      await sql`truncate activity`;
    }
  });
});

describe("GET /api/audit/auth", () => {
  it("event=login_failed returns only failed sign-ins, all of them", async () => {
    const token = await signIn("viewer");
    const expected = (await sql`select count(*)::int as n from auth_log where event = 'login_failed'`)[0].n;
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
    await sql`update users set email = 'moved@example.org' where username = 'viewer'`;
    expect(await ids("user=moved%40example")).toEqual([uuid(2), uuid(1)]);
    expect(await ids(`user=${await idOf("viewer")}`)).toEqual([uuid(2), uuid(1)]);
  });

  it("CSV is named sign-in-<date>.csv and stops at 10,000 rows, newest first", async () => {
    await setAuthLog([]);
    const start = Date.UTC(2026, 8, 1);
    await sql`insert into auth_log (id, at, event, login, user_id, method, ip, device)
      select gen_random_uuid(), ${new Date(start)}::timestamptz + g * interval '1 minute', 'login_success', 'viewer@example.com', null, 'password', '10.0.0.1', 'Chrome on macOS'
      from generate_series(0, 10049) g`;
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
