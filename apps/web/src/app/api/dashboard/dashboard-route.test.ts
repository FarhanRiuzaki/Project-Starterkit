import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import { db, resetDb } from "@/lib/server/mock/db";
import type { AuthLogDto } from "@/lib/shared/contracts/audit";
import type { DashboardDto } from "@/lib/shared/contracts/dashboard";
import { signInAs } from "@/test/session";
import { GET } from "./route";

// 20 Oct 2026, 00:30 WIB (UTC+7): early in the day, so "today" in WIB differs from the UTC date.
const NOW = Date.UTC(2026, 9, 19, 17, 30);
const HOUR = 3_600_000;
const get = async () => GET(new Request("http://c/api/dashboard"));
const body = async () => { const r = await get(); expect(r.status).toBe(200); return (await r.json()) as DashboardDto; };
const entry = (id: string, at: number, event: AuthLogDto["event"]): AuthLogDto => ({
  id, at: new Date(at).toISOString(), userId: null, login: "x@example.com", event, method: "password", ip: "10.0.0.1", device: "test", location: null,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetDb(NOW);
  jar.clear();
});
afterEach(() => vi.useRealTimers());

describe("GET /api/dashboard", () => {
  it("needs a session (any signed-in user, no permission)", async () => {
    expect((await get()).status).toBe(401);
    db().roles.get("role-viewer")!.permissions = [];
    await signInAs(jar, "viewer");
    expect((await get()).status).toBe(200);
  });

  it("without audit.view: recent, failedLogins24h and every day's failed count are null, the rest is filled", async () => {
    db().roles.get("role-viewer")!.permissions = ["user.view"];
    await signInAs(jar, "viewer");
    const b = await body();
    expect(b.recent).toBeNull();
    expect(b.failedLogins24h).toBeNull();
    expect(b.activeUsers).toBeGreaterThan(0);
    expect(b.loginsPerDay).toHaveLength(14);
    expect(b.loginsPerDay.every((d) => d.failed === null && typeof d.success === "number")).toBe(true);
  });

  it("with audit.view: the 5 newest activity entries and the failed sign-ins of the last 24 hours", async () => {
    db().authLog.clear();
    for (const e of [
      entry("f1", NOW - 1 * HOUR, "login_failed"), entry("f2", NOW - 23 * HOUR, "login_failed"),
      entry("f3", NOW - 25 * HOUR, "login_failed"), entry("s1", NOW - 2 * HOUR, "login_success"), entry("t1", NOW - HOUR, "2fa_failed"),
    ]) db().authLog.set(e.id, e);
    await signInAs(jar, "viewer");
    const b = await body();
    expect(b.failedLogins24h).toBe(2);
    expect(b.recent).toHaveLength(5);
    const newest = [...db().activity.values()].map((e) => e.at).sort().reverse().slice(0, 5);
    expect(b.recent!.map((e) => e.at)).toEqual(newest);
  });

  it("loginsPerDay: 14 consecutive WIB days ending today, oldest first, empty days are 0", async () => {
    db().authLog.clear();
    const wibMidnight = Date.UTC(2026, 9, 19, 17, 0); // 00:00 WIB on 20 Oct
    for (const e of [
      entry("a", wibMidnight + 10 * 60_000, "login_success"), // today
      entry("b", wibMidnight - 1, "login_success"), // 23:59:59.999 WIB on 19 Oct
      entry("c", wibMidnight - 3 * 24 * HOUR, "login_failed"), // 17 Oct
      entry("d", wibMidnight - 3 * 24 * HOUR + HOUR, "login_failed"),
      entry("e", wibMidnight - 13 * 24 * HOUR, "login_success"), // 7 Oct, the first day shown
      entry("f", wibMidnight - 14 * 24 * HOUR, "login_success"), // 6 Oct: outside
      entry("g", wibMidnight - 2 * HOUR, "logout"), // not a sign-in
    ]) db().authLog.set(e.id, e);
    await signInAs(jar, "viewer");
    const days = (await body()).loginsPerDay;
    expect(days.map((d) => d.date)).toEqual(Array.from({ length: 14 }, (_, i) => `2026-10-${String(7 + i).padStart(2, "0")}`));
    const at = (date: string) => days.find((d) => d.date === date);
    expect(at("2026-10-20")).toEqual({ date: "2026-10-20", success: 1, failed: 0 });
    expect(at("2026-10-19")).toEqual({ date: "2026-10-19", success: 1, failed: 0 });
    expect(at("2026-10-17")).toEqual({ date: "2026-10-17", success: 0, failed: 2 });
    expect(at("2026-10-07")).toEqual({ date: "2026-10-07", success: 1, failed: 0 });
    expect(days.reduce((n, d) => n + d.success + (d.failed ?? 0), 0)).toBe(5);
  });

  it("counts active users, users created in the last 7 days, and live sessions of active users", async () => {
    const users = [...db().users.values()];
    users[10]!.createdAt = new Date(NOW - 2 * 24 * HOUR).toISOString();
    users[11]!.createdAt = new Date(NOW - 8 * 24 * HOUR).toISOString();
    const { user: viewer } = await signInAs(jar, "viewer");
    const inactive = users.find((u) => !u.isActive)!;
    db().sessions.set("dead", { ...db().sessions.values().next().value!, id: "dead", userId: inactive.id });
    const b = await body();
    expect(b.activeUsers).toBe(users.filter((u) => u.isActive).length);
    expect(b.newUsers7d).toBe(users.filter((u) => Date.parse(u.createdAt) >= NOW - 7 * 24 * HOUR).length);
    expect(b.newUsers7d).toBeGreaterThanOrEqual(1);
    expect(b.activeSessions).toBe(1);
    expect(viewer.isActive).toBe(true);
  });
});
