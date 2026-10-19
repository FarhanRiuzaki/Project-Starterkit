import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import { db, resetDb } from "@/lib/server/mock/db";
import type { ActivityDto, AuthLogDto } from "@/lib/shared/contracts/audit";
import type { Page } from "@/lib/shared/contracts/common";
import { signInAs, TEST_CSRF } from "@/test/session";
import { POST as resetPassword } from "../users/[id]/reset-password/route";
import { PATCH as userPatch } from "../users/[id]/route";
import { GET as activityGet } from "./activity/route";
import { GET as authGet } from "./auth/route";

const url = (kind: "activity" | "auth", qs: string) => `http://c/api/audit/${kind}${qs ? `?${qs}` : ""}`;
const activity = (qs = "") => activityGet(new Request(url("activity", qs)));
const auth = (qs = "") => authGet(new Request(url("auth", qs)));
const page = async <T,>(r: Response) => { expect(r.status).toBe(200); return (await r.json()) as Page<T>; };
const mutate = (method: string, path: string, body?: unknown) => new Request(`http://c${path}`, {
  method, headers: { "content-type": "application/json", "x-csrf-token": TEST_CSRF, origin: "http://c" }, body: body === undefined ? undefined : JSON.stringify(body),
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const idOf = (username: string) => [...db().users.values()].find((u) => u.username === username)!.id;
const act = (id: string, at: string, over: Partial<ActivityDto> = {}): ActivityDto => ({
  id, at, actor: { id: "u-001", name: "Super Admin" }, action: "user.update", target: { type: "user", id: "u-003", label: "Viewer User" }, before: null, after: null, ...over,
});
const log = (id: string, at: string, over: Partial<AuthLogDto> = {}): AuthLogDto => ({
  id, at, userId: "u-003", login: "viewer@example.com", event: "login_success", method: "password", ip: "10.0.0.1", device: "Chrome on macOS", location: null, ...over,
});
/** A custom role holding every permission except audit.view, given to the viewer account. */
function dropAuditView() {
  db().roles.set("role-noaudit", { id: "role-noaudit", name: "No audit", locked: false, permissions: ["user.view", "role.view"] });
  db().users.get(idOf("viewer"))!.roles = ["No audit"];
}

beforeEach(() => {
  resetDb();
  jar.clear();
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
    expect((await get(qs)).status).toBe(400); // no session: a 401 would mean the guard ran first
    await signInAs(jar, "viewer");
    const r = await get(qs);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("bad_request");
  });

  it("92 days inclusive is allowed", async () => {
    await signInAs(jar, "viewer");
    expect((await get("from=2026-01-01&to=2026-04-02")).status).toBe(200);
  });

  it("needs a session, then audit.view (a custom role without it is 403, JSON and CSV alike)", async () => {
    expect((await get()).status).toBe(401);
    dropAuditView();
    await signInAs(jar, "viewer");
    expect((await get()).status).toBe(403);
    expect((await get("format=csv")).status).toBe(403);
  });
});

describe("GET /api/audit/activity", () => {
  it("pages newest first by default (15 rows), with the total of the whole log", async () => {
    await signInAs(jar, "viewer");
    const body = await page<ActivityDto>(await activity());
    expect(body).toMatchObject({ total: db().activity.size, page: 1, pageSize: 15 });
    expect(body.items).toHaveLength(15);
    const ats = body.items.map((e) => e.at);
    expect(ats).toEqual([...ats].sort().reverse());
    const two = await page<ActivityDto>(await activity("page=2&pageSize=25&sort=at"));
    expect(two.items.map((e) => e.at)).toEqual([...db().activity.values()].map((e) => e.at).sort().slice(25, 50));
  });

  it("filters by user (actor name, case-insensitive), action, and a WIB calendar range", async () => {
    db().activity.clear();
    for (const e of [
      act("a1", "2026-10-10T16:59:59.000Z"), // 23:59:59 WIB on 10 Oct
      act("a2", "2026-10-10T17:00:00.000Z"), // 00:00 WIB on 11 Oct
      act("a3", "2026-10-09T17:00:00.000Z", { action: "role.update" }), // 00:00 WIB on 10 Oct
      act("a4", "2026-10-10T10:00:00.000Z", { actor: { id: "u-002", name: "Admin User" } }),
    ]) db().activity.set(e.id, e);
    await signInAs(jar, "viewer");
    const ids = async (qs: string) => (await page<ActivityDto>(await activity(qs))).items.map((e) => e.id);
    expect(await ids("from=2026-10-10&to=2026-10-10")).toEqual(["a1", "a4", "a3"]);
    expect(await ids("from=2026-10-11&to=2026-10-11")).toEqual(["a2"]);
    expect(await ids("action=role.update")).toEqual(["a3"]);
    expect(await ids("user=admin%20user")).toEqual(["a4"]);
    expect(await ids("user=SUPER&action=user.update&from=2026-10-10&to=2026-10-10")).toEqual(["a1"]);
  });

  it("an admin password reset is logged without the password, in JSON and CSV", async () => {
    await signInAs(jar, "admin");
    const res = await resetPassword(mutate("POST", `/api/users/${idOf("viewer")}/reset-password`), params(idOf("viewer")));
    const { temporaryPassword } = (await res.json()) as { temporaryPassword: string };
    expect(temporaryPassword.length).toBeGreaterThan(0);
    const body = await page<ActivityDto>(await activity("action=user.reset_password"));
    expect(body.total).toBeGreaterThanOrEqual(1);
    const mine = body.items.find((e) => e.target.id === idOf("viewer"))!;
    expect(mine.before).toBeNull();
    expect(mine.after).toBeNull();
    expect(JSON.stringify(body)).not.toContain(temporaryPassword);
    expect(await (await activity("format=csv")).text()).not.toContain(temporaryPassword);
  });

  it("CSV: attachment named activity-<WIB date>.csv, no-store, BOM, newest first, formula cells neutralised, same filters", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 9, 19, 17, 30)); // 20 Oct in WIB
    try {
      db().activity.clear();
      db().activity.set("x1", act("x1", "2026-10-18T01:00:00.000Z", { target: { type: "user", id: "u-9", label: '=HYPERLINK("http://evil.example","click")' } }));
      db().activity.set("x2", act("x2", "2026-10-19T01:00:00.000Z", { before: { name: "Old" }, after: { name: "New" } }));
      db().activity.set("x3", act("x3", "2026-10-19T02:00:00.000Z", { action: "role.delete" }));
      await signInAs(jar, "viewer");
      const r = await activity("format=csv&action=user.update&pageSize=15&page=1");
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
      vi.useRealTimers();
    }
  });
});

describe("GET /api/audit/auth", () => {
  it("event=login_failed returns only failed sign-ins, all of them", async () => {
    await signInAs(jar, "viewer");
    const expected = [...db().authLog.values()].filter((e) => e.event === "login_failed").length;
    expect(expected).toBeGreaterThan(0);
    const body = await page<AuthLogDto>(await auth("event=login_failed&pageSize=100"));
    expect(body.total).toBe(expected);
    expect(body.items.every((e) => e.event === "login_failed")).toBe(true);
  });

  it("filters by method and by user (login), newest first", async () => {
    db().authLog.clear();
    for (const e of [
      log("l1", "2026-10-10T01:00:00.000Z"), log("l2", "2026-10-11T01:00:00.000Z", { method: "google", login: "google@example.com" }),
      log("l3", "2026-10-12T01:00:00.000Z", { event: "login_failed", userId: null, login: "nobody@example.com" }),
    ]) db().authLog.set(e.id, e);
    await signInAs(jar, "viewer");
    const ids = async (qs: string) => (await page<AuthLogDto>(await auth(qs))).items.map((e) => e.id);
    expect(await ids("")).toEqual(["l3", "l2", "l1"]);
    expect(await ids("method=google")).toEqual(["l2"]);
    expect(await ids("user=NOBODY")).toEqual(["l3"]);
  });

  it("CSV is named sign-in-<date>.csv and stops at 10,000 rows, newest first", async () => {
    db().authLog.clear();
    const start = Date.UTC(2026, 8, 1);
    for (let i = 0; i < 10_050; i++) { const e = log(`m${i}`, new Date(start + i * 60_000).toISOString()); db().authLog.set(e.id, e); }
    await signInAs(jar, "viewer");
    const r = await auth("format=csv");
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="sign-in-\d{4}-\d{2}-\d{2}\.csv"$/);
    const lines = (await r.text()).trimEnd().split("\r\n");
    expect(lines).toHaveLength(10_001);
    expect(lines[1]).toContain(new Date(start + 10_049 * 60_000).toISOString());
  });
});

describe("audit entries from real actions", () => {
  it("a user edit shows up first in the activity log with its before/after", async () => {
    await signInAs(jar, "admin");
    await userPatch(mutate("PATCH", `/api/users/${idOf("viewer")}`, { name: "Renamed Viewer" }), params(idOf("viewer")));
    const top = (await page<ActivityDto>(await activity())).items[0]!;
    expect(top).toMatchObject({ action: "user.update", target: { id: idOf("viewer") } });
    expect(top.after).toMatchObject({ name: "Renamed Viewer" });
  });
});
