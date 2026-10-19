import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import type { QueryKey } from "@tanstack/react-query";
import { GET as activityGet } from "@/app/api/audit/activity/route";
import { GET as authLogGet } from "@/app/api/audit/auth/route";
import { GET as dashboardGet } from "@/app/api/dashboard/route";
import { GET as meGet } from "@/app/api/me/route";
import { GET as mySessionsGet } from "@/app/api/me/sessions/route";
import { GET as permissionsGet } from "@/app/api/permissions/route";
import { GET as roleGet } from "@/app/api/roles/[id]/route";
import { GET as rolesGet } from "@/app/api/roles/route";
import { GET as userGet } from "@/app/api/users/[id]/route";
import { GET as userSessionsGet } from "@/app/api/users/[id]/sessions/route";
import { GET as roleOptionsGet } from "@/app/api/users/roles/route";
import { GET as usersGet } from "@/app/api/users/route";
import { db, resetDb } from "@/lib/server/mock/db";
import { UserListQuery } from "@/lib/shared/contracts/users";
import { text } from "@/lib/shared/table-state";
import { authOf, getSession } from "@/lib/server/session";
import { readTable, tableRequest } from "@/lib/shared/table-state";
import { userPage } from "./users";
import { ACTIVITY, AUTH_LOG, DASHBOARD_KEY, ME_KEY, MY_SESSIONS, PERMISSIONS_TABLE, roleKey, roleOptions, ROLES, SUPERADMINS, type TableDef, userDetail, USERS, userSessions } from "@/lib/shared/queries";
import { addSession, signInAs } from "@/test/session";
import { Prefetch, prefetchState, reads, type Read, table, toSearch } from "./prefetch";

const ctxOf = async (username: string) => {
  await signInAs(jar, username);
  return authOf(await getSession())!;
};
const at = (path: string) => new Request(`http://c${path}`);
const id = (v: string) => ({ params: Promise.resolve({ id: v }) });
const body = async (r: Response) => { expect(r.status).toBe(200); return r.json(); };
const sp = (qs: string) => toSearch(Object.fromEntries(new URLSearchParams(qs)));
/** What the prefetch put under `key`, or undefined when it skipped the read. */
const dataAt = (rs: Read[], ctx: Awaited<ReturnType<typeof ctxOf>>, key: QueryKey) =>
  prefetchState(ctx, rs).queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(key))?.state.data;
/** The key useTableQuery builds for `table` at URL state `qs`, and the request it would send. */
const tableKey = <F extends Record<string, string>>(table: TableDef<F>, qs: string) => {
  const { url } = tableRequest(table.path, readTable(new URLSearchParams(qs), table.spec), table.spec, table.params);
  return { key: [table.key, url] as const, url };
};

beforeEach(() => {
  resetDb();
  jar.clear();
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() }); // the API stamps lastSeenAt; a frozen clock makes both reads equal
});
afterEach(() => vi.useRealTimers());

describe("server prefetch = the /api route's own data, under the browser hook's key", () => {
  it("dashboard and profile", async () => {
    const ctx = await ctxOf("superadmin");
    expect(dataAt([reads.dashboard()], ctx, DASHBOARD_KEY)).toEqual(await body(await dashboardGet(at("/api/dashboard"))));
    expect(dataAt([reads.me()], ctx, ME_KEY)).toEqual(await body(await meGet(at("/api/me"))));
  });

  it("users table at the URL's page, sort and filters, plus the role options and the Superadmin check", async () => {
    const ctx = await ctxOf("superadmin");
    const t = tableKey(USERS, "q=a&status=active&sort=-createdAt&page=2&pageSize=25");
    expect(t.url).toBe("/api/users?q=a&status=active&page=2&pageSize=25&sort=-createdAt");
    const rs = [reads.users(sp("q=a&status=active&sort=-createdAt&page=2&pageSize=25")), reads.roleOptions(), reads.superadmins()];
    expect(dataAt(rs, ctx, t.key)).toEqual(await body(await usersGet(at(t.url))));
    expect(dataAt(rs, ctx, roleOptions().key)).toEqual(await body(await roleOptionsGet(at(roleOptions().url))));
    expect(dataAt(rs, ctx, SUPERADMINS.key)).toEqual(await body(await usersGet(at(SUPERADMINS.url))));
  });

  it("user detail and that user's sessions (no detail → sessions waterfall)", async () => {
    const ctx = await ctxOf("superadmin");
    addSession("u-002");
    const t = tableKey(userSessions("u-002"), "sort=device");
    const rs = [reads.user("u-002"), reads.userSessions("u-002", sp("sort=device"))];
    expect(dataAt(rs, ctx, userDetail("u-002").key)).toEqual(await body(await userGet(at("/api/users/u-002"), id("u-002"))));
    expect(dataAt(rs, ctx, t.key)).toEqual(await body(await userSessionsGet(at(t.url), id("u-002"))));
  });

  it("own sessions", async () => {
    const ctx = await ctxOf("viewer");
    const t = tableKey(MY_SESSIONS, "");
    expect(dataAt([reads.mySessions(sp(""))], ctx, t.key)).toEqual(await body(await mySessionsGet(at(t.url))));
  });

  it("roles table, one role, permissions table", async () => {
    const ctx = await ctxOf("superadmin");
    const roles = tableKey(ROLES, "q=adm");
    const perms = tableKey(PERMISSIONS_TABLE, "module=user&sort=-name");
    const rs = [reads.roles(sp("q=adm")), reads.role("role-admin"), reads.permissions(sp("module=user&sort=-name"))];
    expect(dataAt(rs, ctx, roles.key)).toEqual(await body(await rolesGet(at(roles.url))));
    expect(dataAt(rs, ctx, roleKey("role-admin"))).toEqual(await body(await roleGet(at("/api/roles/role-admin"), id("role-admin"))));
    expect(dataAt(rs, ctx, perms.key)).toEqual(await body(await permissionsGet(at(perms.url))));
  });

  it("audit logs: the range preset becomes the same from/to the browser sends", async () => {
    const ctx = await ctxOf("superadmin");
    const act = tableKey(ACTIVITY, "range=30d&action=user.update");
    const auth = tableKey(AUTH_LOG, "event=login_failed");
    expect(act.url).toMatch(/^\/api\/audit\/activity\?action=user\.update&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&page=1/);
    const rs = [reads.activity(sp("range=30d&action=user.update")), reads.authLog(sp("event=login_failed"))];
    expect(dataAt(rs, ctx, act.key)).toEqual(await body(await activityGet(at(act.url))));
    expect(dataAt(rs, ctx, auth.key)).toEqual(await body(await authLogGet(at(auth.url))));
  });
});

describe("server prefetch reads only what the user may read", () => {
  it("a read the /api route would refuse (403) is skipped; the browser then shows its own state", async () => {
    const ctx = await ctxOf("viewer"); // user.view + audit.view only
    const rs = [reads.roles(sp("")), reads.role("role-admin"), reads.permissions(sp("")), reads.users(sp(""))];
    expect(dataAt(rs, ctx, tableKey(ROLES, "").key)).toBeUndefined();
    expect(dataAt(rs, ctx, roleKey("role-admin"))).toBeUndefined();
    expect(dataAt(rs, ctx, tableKey(PERMISSIONS_TABLE, "").key)).toBeUndefined();
    expect(dataAt(rs, ctx, tableKey(USERS, "").key)).toBeDefined();
  });

  it("a record that doesn't exist (the route's 404) is skipped", async () => {
    const ctx = await ctxOf("superadmin");
    const rs = [reads.user("nope"), reads.userSessions("nope", sp("")), reads.role("nope")];
    expect(prefetchState(ctx, rs).queries).toEqual([]);
  });
});

describe("server prefetch edge cases", () => {
  it("dashboard for a user without audit.view: the route's own answer, without the audit parts", async () => {
    db().roles.set("role-reader", { id: "role-reader", name: "Reader", locked: false, permissions: ["user.view"] });
    db().users.get("u-003")!.roles = ["Reader"]; // viewer
    const ctx = await ctxOf("viewer");
    expect(ctx.perms.has("audit.view")).toBe(false);
    const data = dataAt([reads.dashboard()], ctx, DASHBOARD_KEY) as { failedLogins24h: unknown; recent: unknown };
    expect(data).toEqual(await body(await dashboardGet(at("/api/dashboard"))));
    expect(data.failedLogins24h).toBeNull();
    expect(data.recent).toBeNull();
  });

  it("no session: nothing is prefetched (the layout sends the browser to sign-in)", async () => {
    const el = await Prefetch({ reads: [reads.dashboard(), reads.me()], children: null });
    expect((el.props as { state: unknown }).state).toBeUndefined();
  });

  it("a request URL the route's schema rejects (its 400) reads nothing", async () => {
    const ctx = await ctxOf("superadmin");
    // A table spec looser than the route: status takes any text, UserListQuery takes active | inactive only.
    const loose = { key: "users", path: "/api/users", spec: { sorts: ["name"], defaultSort: "name", filters: { status: text(20) } } } as const;
    const read = table(loose, sp("status=bogus"), "user.view", UserListQuery, userPage);
    expect(read.key).toEqual(["users", "/api/users?status=bogus&page=1&pageSize=15&sort=name"]);
    expect(prefetchState(ctx, [read]).queries).toEqual([]);
    expect((await usersGet(at("/api/users?status=bogus"))).status).toBe(400);
  });
});
