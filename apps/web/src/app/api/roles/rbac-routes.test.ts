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
import { signInAs, TEST_CSRF } from "@/test/session";
import type { Page } from "@starterkit/shared/contracts/common";
import type { PermissionDto, RoleDto } from "@starterkit/shared/contracts/rbac";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { GET as meGet } from "../me/route";
import { GET as permsGet, POST as permsPost } from "../permissions/route";
import { GET as userRolesGet } from "../users/roles/route";
import { DELETE as roleDelete, GET as roleGet, PATCH as rolePatch } from "./[id]/route";
import { GET as listGet, POST as createPost } from "./route";

const CSRF = TEST_CSRF;

const signIn = (username: string) => signInAs(jar, username);
/** A role with exactly `perms`, given to `username` as their only role. */
function giveOnlyRole(username: string, perms: PermissionName[]) {
  db().roles.set("role-custom", { id: "role-custom", name: "Custom", locked: false, permissions: perms });
  [...db().users.values()].find((u) => u.username === username)!.roles = ["Custom"];
}

const req = (method: string, body?: unknown, url = "http://c/api/roles", csrf = CSRF) =>
  new Request(url, { method, headers: { "content-type": "application/json", "x-csrf-token": csrf, origin: "http://c" }, body: body === undefined ? undefined : JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
/** Activity written by this test (seed entries have ids like act-0001). */
const acts = () => [...db().activity.values()].filter((a) => !/^act-\d+$/.test(a.id));
const patch = (id: string, body: unknown, csrf = CSRF) => rolePatch(req("PATCH", body, `http://c/api/roles/${id}`, csrf), params(id));
const del = (id: string) => roleDelete(req("DELETE", undefined, `http://c/api/roles/${id}`), params(id));
const rolePage = async (qs = "") => (await (await listGet(req("GET", undefined, `http://c/api/roles?${qs}`))).json()) as Page<RoleDto>;
const roles = async (qs = "pageSize=100") => (await rolePage(qs)).items;
const permPage = async (qs = "") => (await (await permsGet(req("GET", undefined, `http://c/api/permissions?${qs}`))).json()) as Page<PermissionDto>;
const perms = async (qs = "pageSize=100") => (await permPage(qs)).items;
const addPerms = (body: unknown) => permsPost(req("POST", body, "http://c/api/permissions"));

beforeEach(() => {
  resetDb();
  jar.clear();
});

describe("GET /api/roles and /api/roles/[id]", () => {
  it("needs a session and role.view; Admin and Viewer don't have it", async () => {
    expect((await listGet(req("GET"))).status).toBe(401);
    await signIn("admin");
    expect((await listGet(req("GET"))).status).toBe(403);
    await signIn("viewer");
    expect((await listGet(req("GET"))).status).toBe(403);
  });

  it("lists roles as a page, name A–Z by default, with user counts that match the users", async () => {
    await signIn("superadmin");
    const page = await rolePage();
    expect(page).toMatchObject({ total: 3, page: 1, pageSize: 15 });
    expect(page.items.map((r) => r.name)).toEqual(["Admin", "Superadmin", "Viewer"]);
    const users = [...db().users.values()];
    for (const r of page.items) expect(r.userCount).toBe(users.filter((u) => u.roles.includes(r.name)).length);
    expect(page.items[1]).toMatchObject({ id: "role-superadmin", locked: true, permissions: [...PERMISSIONS] });
  });

  it("sorts by permissions and users, searches the name, pages past the end empty", async () => {
    await signIn("superadmin");
    expect((await roles("sort=-permissions")).map((r) => r.name)).toEqual(["Superadmin", "Admin", "Viewer"]);
    const byUsers = await roles("sort=users");
    expect(byUsers.map((r) => r.userCount)).toEqual([...byUsers.map((r) => r.userCount)].sort((a, b) => a - b));
    expect((await roles("q=ADM")).map((r) => r.name)).toEqual(["Admin", "Superadmin"]);
    expect(await rolePage("page=2")).toMatchObject({ items: [], total: 3, page: 2 });
  });

  it.each([["pageSize=10"], ["page=1001"], ["sort=locked"], ["sort=-userCount"]])("rejects %s with 400 before the guard", async (qs) => {
    expect((await listGet(req("GET", undefined, `http://c/api/roles?${qs}`))).status).toBe(400);
  });

  it("GET one role, 404 for an unknown id", async () => {
    await signIn("superadmin");
    expect(await (await roleGet(req("GET"), params("role-viewer"))).json()).toMatchObject({ name: "Viewer", permissions: ["user.view", "audit.view"] });
    const r = await roleGet(req("GET"), params("role-nope"));
    expect(r.status).toBe(404);
    expect(await code(r)).toBe("not_found");
  });

  it("/api/users/roles (user.view) answers the same names from the same source", async () => {
    await signIn("superadmin");
    await createPost(req("POST", { name: "Auditor" }));
    await signIn("viewer");
    expect((await (await userRolesGet(req("GET"))).json() as Page<{ name: string }>).items.map((r) => r.name)).toEqual(["Admin", "Auditor", "Superadmin", "Viewer"]);
  });
});

describe("POST /api/roles", () => {
  it("Admin gets 403 and nothing is created; a missing csrf token is 403 csrf", async () => {
    await signIn("admin");
    expect((await createPost(req("POST", { name: "Auditor" }))).status).toBe(403);
    await signIn("superadmin");
    const r = await createPost(req("POST", { name: "Auditor" }, undefined, "x"));
    expect(await code(r)).toBe("csrf");
    expect(db().roles.size).toBe(3);
  });

  it("creates an empty role, 201, one activity entry", async () => {
    await signIn("superadmin");
    const r = await createPost(req("POST", { name: "  Auditor " }));
    expect(r.status).toBe(201);
    const dto = (await r.json()) as RoleDto;
    expect(dto).toMatchObject({ name: "Auditor", locked: false, permissions: [], userCount: 0 });
    expect(db().roles.get(dto.id)?.name).toBe("Auditor");
    expect(acts().filter((a) => a.action === "role.create")).toHaveLength(1);
  });

  it("a taken name (case-insensitive) is 409 duplicate; a bad name or unknown permission is 400", async () => {
    await signIn("superadmin");
    expect(await code(await createPost(req("POST", { name: "admin" })))).toBe("duplicate");
    expect((await createPost(req("POST", { name: "A" }))).status).toBe(400);
    expect((await createPost(req("POST", { name: "Ok", permissions: ["user.fly"] }))).status).toBe(400);
    expect((await createPost(req("POST", null))).status).toBe(400);
    expect(db().roles.size).toBe(3);
  });

  it("can't create a role carrying a permission the actor lacks", async () => {
    giveOnlyRole("admin", ["role.view", "role.create"]);
    await signIn("admin");
    expect((await createPost(req("POST", { name: "Ops", permissions: ["role.view"] }))).status).toBe(201);
    expect(await code(await createPost(req("POST", { name: "Ops2", permissions: ["user.delete"] })))).toBe("forbidden");
  });
});

describe("PATCH /api/roles/[id]", () => {
  it("Superadmin is 409 superadmin_locked, even for the Superadmin user", async () => {
    await signIn("superadmin");
    const r = await patch("role-superadmin", { name: "Root" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("superadmin_locked");
    expect(db().roles.get("role-superadmin")!.name).toBe("Superadmin");
  });

  it("Admin without role.edit is 403 and the role is unchanged", async () => {
    await signIn("admin");
    expect((await patch("role-viewer", { remove: ["user.view"] })).status).toBe(403);
    expect(db().roles.get("role-viewer")!.permissions).toEqual(["user.view", "audit.view"]);
  });

  it("unknown permission or bad body is 400; unknown id is 404; taken name is 409", async () => {
    await signIn("superadmin");
    expect((await patch("role-viewer", { add: ["audit.create"] })).status).toBe(400);
    expect((await patch("role-viewer", { add: ["user.edit"], remove: ["user.edit"] })).status).toBe(400);
    expect((await patch("role-viewer", { permissions: ["user.view"] })).status).toBe(400);
    expect((await patch("role-viewer", { name: "" })).status).toBe(400);
    expect((await patch("role-nope", { name: "X1" })).status).toBe(404);
    expect(await code(await patch("role-viewer", { name: "ADMIN" }))).toBe("duplicate");
  });

  it("no escalation: adding or removing a permission the actor lacks is 403; held ones go through", async () => {
    giveOnlyRole("admin", ["role.view", "role.edit", "user.view"]);
    await signIn("admin");
    // Viewer = user.view + audit.view; the actor lacks audit.view and user.delete
    expect(await code(await patch("role-viewer", { add: ["user.delete"] }))).toBe("forbidden");
    expect(await code(await patch("role-viewer", { remove: ["audit.view"] }))).toBe("forbidden");
    // checked on what is asked, even when it would change nothing
    expect(await code(await patch("role-viewer", { add: ["audit.view"] }))).toBe("forbidden");
    expect(db().roles.get("role-viewer")!.permissions).toEqual(["user.view", "audit.view"]);
    const ok = await patch("role-viewer", { add: ["role.view"], remove: ["user.view"] });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as RoleDto).permissions).toEqual(["role.view", "audit.view"]);
  });

  it("after PATCH, userCount, PermissionDto.roles and the users' own permissions agree", async () => {
    await signIn("superadmin");
    const before = (await roles()).find((r) => r.id === "role-viewer")!.userCount;
    const r = await patch("role-viewer", { add: ["user.create", "user.view"] });
    const dto = (await r.json()) as RoleDto;
    expect(dto.userCount).toBe(before);
    expect((await perms()).find((p) => p.name === "user.create")!.roles).toContain("Viewer");
    expect((await perms()).find((p) => p.name === "user.view")!.roles).toEqual(["Admin", "Superadmin", "Viewer"]);
    const entry = acts().find((a) => a.action === "role.update")!;
    expect(entry).toMatchObject({ target: { type: "role", id: "role-viewer", label: "Viewer" }, before: { name: "Viewer" }, after: { name: "Viewer", added: ["user.create"], removed: [] } });
  });

  it("rename carries the users along: same count, new name on their records and in the role list", async () => {
    await signIn("superadmin");
    const count = (await roles()).find((r) => r.id === "role-viewer")!.userCount;
    const dto = (await (await patch("role-viewer", { name: "Reader" })).json()) as RoleDto;
    expect(dto).toMatchObject({ name: "Reader", userCount: count });
    expect([...db().users.values()].filter((u) => u.roles.includes("Viewer"))).toHaveLength(0);
    // a renamed role still grants its permissions on the next request
    await signIn("viewer");
    expect((await meGet(req("GET", undefined, "http://c/api/me"))).status).toBe(200);
    expect((await (await userRolesGet(req("GET"))).json() as Page<{ name: string }>).items.map((r) => r.name)).toEqual(["Admin", "Reader", "Superadmin"]);
  });

  it("removing a permission takes effect on the holder's next request", async () => {
    giveOnlyRole("admin", ["role.view", "role.edit"]);
    await signIn("superadmin");
    expect((await patch("role-custom", { remove: ["role.view", "role.edit"] })).status).toBe(200);
    await signIn("admin");
    expect((await listGet(req("GET"))).status).toBe(403);
  });
});

describe("PATCH applies add/remove to the current set", () => {
  it("concurrent revoke is not undone by a stale save that adds another permission", async () => {
    await signIn("superadmin");
    // two pages loaded Viewer = user.view + audit.view; the first revokes audit.view
    expect((await patch("role-viewer", { remove: ["audit.view"] })).status).toBe(200);
    // the stale page only added user.create; it must not send audit.view back
    const dto = (await (await patch("role-viewer", { add: ["user.create"] })).json()) as RoleDto;
    expect(dto.permissions).toEqual(["user.view", "user.create"]);
    const last = acts().filter((a) => a.action === "role.update").at(-1)!;
    expect(last.after).toEqual({ name: "Viewer", added: ["user.create"], removed: [] });
  });

  it("activity records only the effective change", async () => {
    await signIn("superadmin");
    await patch("role-viewer", { add: ["user.view", "user.edit"], remove: ["role.view"] });
    expect(acts().find((a) => a.action === "role.update")!.after).toEqual({ name: "Viewer", added: ["user.edit"], removed: [] });
  });

  it("a PATCH that changes nothing is 200 with the role and writes no activity", async () => {
    await signIn("superadmin");
    for (const body of [{}, { name: "Viewer" }, { add: ["user.view"] }, { remove: ["role.view"] }]) {
      const r = await patch("role-viewer", body);
      expect(r.status).toBe(200);
      expect(((await r.json()) as RoleDto).permissions).toEqual(["user.view", "audit.view"]);
    }
    expect(acts()).toHaveLength(0);
  });

  it("the Superadmin name can't be taken by create or rename (409 duplicate)", async () => {
    await signIn("superadmin");
    expect(await code(await createPost(req("POST", { name: "Superadmin" })))).toBe("duplicate");
    expect(await code(await createPost(req("POST", { name: "superadmin" })))).toBe("duplicate");
    expect(await code(await patch("role-viewer", { name: "SUPERADMIN" }))).toBe("duplicate");
    expect(db().roles.size).toBe(3);
  });
});

describe("DELETE /api/roles/[id]", () => {
  it("Superadmin is 409 superadmin_locked; a role in use is 409 role_in_use; Admin is 403", async () => {
    await signIn("admin");
    expect((await del("role-viewer")).status).toBe(403);
    await signIn("superadmin");
    expect(await code(await del("role-superadmin"))).toBe("superadmin_locked");
    const r = await del("role-viewer");
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("role_in_use");
    expect(db().roles.has("role-viewer")).toBe(true);
  });

  it("deletes an unused role with one activity entry; then 404", async () => {
    await signIn("superadmin");
    const { id } = (await (await createPost(req("POST", { name: "Temp", permissions: ["user.view"] }))).json()) as RoleDto;
    expect((await del(id)).status).toBe(200);
    expect(db().roles.has(id)).toBe(false);
    expect(acts().find((a) => a.action === "role.delete")).toMatchObject({ target: { id, label: "Temp" }, before: { name: "Temp", permissions: ["user.view"] } });
    expect((await del(id)).status).toBe(404);
  });
});

describe("/api/permissions", () => {
  it("GET needs permission.view; lists the catalog with the roles holding each", async () => {
    expect((await permsGet(req("GET"))).status).toBe(401);
    await signIn("admin");
    expect((await permsGet(req("GET"))).status).toBe(403);
    await signIn("superadmin");
    const page = await permPage();
    expect(page).toMatchObject({ total: PERMISSIONS.length, page: 1, pageSize: 15 });
    const list = await perms();
    expect(list.map((p) => p.name)).toEqual([...PERMISSIONS]); // default sort: catalog (module) order
    expect(list.every((p) => p.id === p.name)).toBe(true);
    expect(list.find((p) => p.name === "role.edit")!.roles).toEqual(["Superadmin"]);
    expect(list.find((p) => p.name === "audit.view")!.roles).toEqual(["Admin", "Superadmin", "Viewer"]);
  });

  it("filters by module, searches the name, sorts by name and action", async () => {
    await signIn("superadmin");
    expect((await perms("module=role")).map((p) => p.name)).toEqual(["role.view", "role.create", "role.edit", "role.delete"]);
    expect((await perms("q=CREATE")).map((p) => p.name)).toEqual(["user.create", "role.create", "permission.create"]);
    const byName = (await perms("sort=-name")).map((p) => p.name);
    expect(byName).toEqual([...byName].sort().reverse());
    expect((await perms("module=user&sort=action")).map((p) => p.name)).toEqual(["user.create", "user.delete", "user.edit", "user.view"]);
  });

  it.each([["module=billing"], ["pageSize=7"], ["sort=roles"]])("GET rejects %s with 400 before the guard", async (qs) => {
    expect((await permsGet(req("GET", undefined, `http://c/api/permissions?${qs}`))).status).toBe(400);
  });

  it.each([[["foo"]], [["billing.view"]], [["user."]], [["User.view"]], [["user.view.x"]], [["user.vi ew"]], [[]], [null]])("POST %j is 400", async (names) => {
    await signIn("superadmin");
    expect((await addPerms({ names })).status).toBe(400);
  });

  it("POST is 400 when the catalog would pass 500 names; nothing is added", async () => {
    await signIn("superadmin");
    for (let i = db().permissionCatalog.size; i < 499; i++) db().permissionCatalog.add(`audit.x${i}`);
    expect((await addPerms({ names: ["audit.one", "audit.two"] })).status).toBe(400);
    expect(db().permissionCatalog.size).toBe(499);
    expect((await addPerms({ names: ["audit.one", "user.view"] })).status).toBe(200);
    expect(db().permissionCatalog.size).toBe(500);
  });

  it("POST needs permission.create; adds new names, skips existing ones, logs only the added", async () => {
    giveOnlyRole("admin", ["permission.view"]);
    await signIn("admin");
    expect((await addPerms({ names: ["audit.export"] })).status).toBe(403);
    await signIn("superadmin");
    const r = await addPerms({ names: ["audit.export", "user.view", "audit.export"] });
    expect(await r.json()).toEqual({ created: ["audit.export"], skipped: ["user.view"] });
    expect((await perms()).find((p) => p.name === "audit.export")).toEqual({ id: "audit.export", name: "audit.export", roles: [], roleCount: 0 });
    const entries = acts().filter((a) => a.action === "permission.create");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.after).toEqual({ created: ["audit.export"] });
  });
});

describe("a module's view comes with its other actions", () => {
  it("create and PATCH add the module's view when any other action of it is on; removing view alone keeps it", async () => {
    await signIn("superadmin");
    const c = await createPost(req("POST", { name: "Editors", permissions: ["user.edit", "permission.create"] }));
    expect(((await c.json()) as RoleDto).permissions).toEqual(["user.view", "user.edit", "permission.view", "permission.create"]);
    const id = [...db().roles.values()].find((r) => r.name === "Editors")!.id;
    const p = await patch(id, { add: ["role.delete"], remove: ["user.view"] });
    expect(((await p.json()) as RoleDto).permissions).toEqual(["user.view", "user.edit", "role.view", "role.delete", "permission.view", "permission.create"]);
    expect(acts().filter((a) => a.action === "role.update").at(-1)!.after).toEqual({ name: "Editors", added: ["role.view", "role.delete"], removed: [] });
  });

  it("the implied view counts for the escalation check", async () => {
    giveOnlyRole("admin", ["role.view", "role.create", "audit.view", "user.edit"]);
    await signIn("admin");
    expect(await code(await createPost(req("POST", { name: "Editors", permissions: ["user.edit"] })))).toBe("forbidden"); // would carry user.view
  });
});

describe("PermissionDto: role names are capped", () => {
  it("roles lists at most 10 names; roleCount is the real number", async () => {
    await signIn("superadmin");
    for (let i = 0; i < 12; i++) db().roles.set(`role-r${i}`, { id: `role-r${i}`, name: `Readers ${String(i).padStart(2, "0")}`, locked: false, permissions: ["audit.view"] });
    const p = (await perms()).find((x) => x.name === "audit.view")!;
    expect(p.roleCount).toBe(15);
    expect(p.roles).toHaveLength(10);
  });
});

describe("role names in lookups are case-insensitive", () => {
  it("a rename that only changes letter case is allowed and moves the holders", async () => {
    await signIn("superadmin");
    expect((await patch("role-viewer", { name: "VIEWER" })).status).toBe(200);
    expect(db().users.get("u-003")!.roles).toEqual(["VIEWER"]);
  });
});
