import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.INTERNAL_API_TOKEN = "i".repeat(40);
});
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
  headers: async () => new Headers({ "user-agent": "Browser/1" }),
}));

import type { QueryKey } from "@tanstack/react-query";
import { UserListQuery } from "@starterkit/shared/contracts/users";
import { readTable, tableRequest, text } from "@/lib/shared/table-state";
import { ACTIVITY, AUTH_LOG, DASHBOARD_KEY, ME_KEY, MY_SESSIONS, PERMISSIONS_TABLE, roleKey, roleOptions, ROLES, SUPERADMINS, type TableDef, userDetail, USERS, userSessions } from "@/lib/shared/queries";
import { fakeApi, pathOf, sealCookie, TEST_TOKEN } from "@/test/session";
import { Prefetch, prefetchState, reads, type Read, table, toSearch } from "./prefetch";

const sp = (qs: string) => toSearch(Object.fromEntries(new URLSearchParams(qs)));
/** The key useTableQuery builds for `table` at URL state `qs`, and the request it would send. */
const tableKey = <F extends Record<string, string>>(t: TableDef<F>, qs: string) => {
  const { url } = tableRequest(t.path, readTable(new URLSearchParams(qs), t.spec), t.spec, t.params);
  return { key: [t.key, url] as const, url };
};
/** A fake API that answers each GET with `{ at: <path the API got> }`, or the status `statusOf` gives. */
const echoApi = (statusOf: (path: string) => number = () => 200) =>
  fakeApi((r) => {
    const status = statusOf(pathOf(r));
    return status === 200 ? Response.json({ at: pathOf(r) }) : Response.json({ error: { code: "x", message: "x" } }, { status });
  });
const dataAt = async (rs: Read[], key: QueryKey) =>
  (await prefetchState(TEST_TOKEN, rs)).queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(key))?.state.data;
/** The /v1 path the API gets for the browser's /api URL. */
const v1 = (url: string) => ({ at: url.replace(/^\/api\//, "/v1/") });

beforeEach(() => jar.clear());
afterEach(() => vi.unstubAllGlobals());

describe("server prefetch = the API's answer to the browser hook's own URL, under the hook's key", () => {
  it("dashboard and profile", async () => {
    const seen = echoApi();
    expect(await dataAt([reads.dashboard()], DASHBOARD_KEY)).toEqual(v1("/api/dashboard"));
    expect(await dataAt([reads.me()], ME_KEY)).toEqual(v1("/api/me"));
    expect(seen.every((r) => r.method === "GET" && r.headers.get("authorization") === `Bearer ${TEST_TOKEN}`)).toBe(true);
  });

  it("users table at the URL's page, sort and filters, plus the role options and the Superadmin check", async () => {
    echoApi();
    const t = tableKey(USERS, "q=a&status=active&sort=-createdAt&page=2&pageSize=25");
    expect(t.url).toBe("/api/users?q=a&status=active&page=2&pageSize=25&sort=-createdAt");
    const rs = [reads.users(sp("q=a&status=active&sort=-createdAt&page=2&pageSize=25")), reads.roleOptions(), reads.superadmins()];
    expect(await dataAt(rs, t.key)).toEqual(v1(t.url));
    expect(await dataAt(rs, roleOptions().key)).toEqual(v1(roleOptions().url));
    expect(await dataAt(rs, SUPERADMINS.key)).toEqual(v1(SUPERADMINS.url));
  });

  it("user detail and that user's sessions; own sessions", async () => {
    echoApi();
    const id = "0199f0a0-0000-7000-8000-000000000002";
    const t = tableKey(userSessions(id), "sort=device");
    const rs = [reads.user(id), reads.userSessions(id, sp("sort=device")), reads.mySessions(sp(""))];
    expect(await dataAt(rs, userDetail(id).key)).toEqual(v1(`/api/users/${id}`));
    expect(await dataAt(rs, t.key)).toEqual(v1(t.url));
    expect(await dataAt(rs, tableKey(MY_SESSIONS, "").key)).toEqual(v1(tableKey(MY_SESSIONS, "").url));
  });

  it("roles table, one role, permissions table", async () => {
    echoApi();
    const id = "0199f0a0-0000-7000-8000-00000000000a";
    const roles = tableKey(ROLES, "q=adm");
    const perms = tableKey(PERMISSIONS_TABLE, "module=user&sort=-name");
    const rs = [reads.roles(sp("q=adm")), reads.role(id), reads.permissions(sp("module=user&sort=-name"))];
    expect(await dataAt(rs, roles.key)).toEqual(v1(roles.url));
    expect(await dataAt(rs, roleKey(id))).toEqual(v1(`/api/roles/${id}`));
    expect(await dataAt(rs, perms.key)).toEqual(v1(perms.url));
  });

  it("audit logs: the range preset becomes the same from/to the browser sends", async () => {
    echoApi();
    const act = tableKey(ACTIVITY, "range=30d&action=user.update");
    const auth = tableKey(AUTH_LOG, "event=login_failed");
    expect(act.url).toMatch(/^\/api\/audit\/activity\?action=user\.update&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&page=1/);
    const rs = [reads.activity(sp("range=30d&action=user.update")), reads.authLog(sp("event=login_failed"))];
    expect(await dataAt(rs, act.key)).toEqual(v1(act.url));
    expect(await dataAt(rs, auth.key)).toEqual(v1(auth.url));
  });

  it("all reads are sent at once, not one after another", async () => {
    let open = 0;
    let most = 0;
    fakeApi(async () => {
      most = Math.max(most, ++open);
      await new Promise((r) => setTimeout(r, 20));
      open--;
      return Response.json({});
    });
    await prefetchState(TEST_TOKEN, [reads.users(sp("")), reads.roleOptions(), reads.superadmins()]);
    expect(most).toBe(3);
  });
});

describe("server prefetch keeps only 200 answers", () => {
  it("a read the API refuses (403), a record that doesn't exist (404) and an API failure (500) are left out", async () => {
    echoApi((p) => (p.startsWith("/v1/roles") ? 403 : p.startsWith("/v1/users/") ? 404 : p.startsWith("/v1/permissions") ? 500 : 200));
    const id = "0199f0a0-0000-7000-8000-000000000002";
    const state = await prefetchState(TEST_TOKEN, [reads.roles(sp("")), reads.role(id), reads.user(id), reads.permissions(sp("")), reads.users(sp(""))]);
    expect(state.queries.map((q) => q.queryKey)).toEqual([tableKey(USERS, "").key]);
  });

  it("no session: nothing is read (the layout sends the browser to sign-in)", async () => {
    const seen = echoApi();
    const el = await Prefetch({ reads: [reads.dashboard(), reads.me()], children: null });
    expect((el.props as { state: unknown }).state).toBeUndefined();
    await sealCookie(jar, { challenge: "pending" });
    expect(((await Prefetch({ reads: [reads.me()], children: null })).props as { state: unknown }).state).toBeUndefined();
    expect(seen).toEqual([]);
  });

  it("with a session: the cookie's token and the browser's user agent go with each read", async () => {
    const seen = echoApi();
    await sealCookie(jar);
    const el = await Prefetch({ reads: [reads.me()], children: null });
    expect((el.props as { state: { queries: unknown[] } }).state.queries).toHaveLength(1);
    expect([seen[0]!.headers.get("authorization"), seen[0]!.headers.get("x-client-ua")]).toEqual([`Bearer ${TEST_TOKEN}`, "Browser/1"]);
  });

  it("a request URL the route's schema rejects (its 400), or a path outside /api/[a-z0-9/_-], reads nothing", async () => {
    const seen = echoApi();
    // A table spec looser than the route: status takes any text, UserListQuery takes active | inactive only.
    const loose = { key: "users", path: "/api/users", spec: { sorts: ["name"], defaultSort: "name", filters: { status: text(20) } } } as const;
    const read = table(loose, sp("status=bogus"), UserListQuery);
    expect(read).toEqual({ key: ["users", "/api/users?status=bogus&page=1&pageSize=15&sort=name"], path: null });
    expect((await prefetchState(TEST_TOKEN, [read, reads.user("../dashboard"), reads.role("A.b")])).queries).toEqual([]);
    expect(seen).toEqual([]);
  });
});
