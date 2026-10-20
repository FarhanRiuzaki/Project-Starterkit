// Port of apps/web/src/app/api/roles/rbac-routes.test.ts against /v1/roles, /v1/permissions and /v1/users/roles.
// Not ported: the csrf-token case (the web checks CSRF, Task 9). Role ids are UUIDs now: `idOf` looks them up by name.
import { beforeEach, describe, expect, it } from "bun:test";
import type { Page } from "@starterkit/shared/contracts/common";
import type { PermissionDto, RoleDto } from "@starterkit/shared/contracts/rbac";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { call, resetData, signIn } from "../../test/app";
import { sql } from "../db/client";

const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
const idOf = async (name: string): Promise<string> => (await sql`select id from roles where name = ${name}`)[0].id;
const roleNames = async (): Promise<string[]> => (await sql`select name from roles order by name`).map((r: { name: string }) => r.name);
const permsOf = async (id: string): Promise<string[]> =>
  (await sql`select rp.permission from role_permissions rp join permissions p on p.name = rp.permission where rp.role_id = ${id} order by p.position`).map((r: { permission: string }) => r.permission);
/** Activity written by this test (beforeEach empties the table). */
const acts = async (action?: string) =>
  (await sql`select action, target_type as "targetType", target_id as "targetId", target_label as "targetLabel", before, after from activity
    where ${action ?? ""} = '' or action = ${action ?? ""} order by at, id`) as { action: string; targetType: string; targetId: string; targetLabel: string; before: unknown; after: unknown }[];

/** A role "Custom" with exactly `perms`, the only role of `username`. */
async function giveOnlyRole(username: string, perms: PermissionName[]) {
  const id = Bun.randomUUIDv7();
  await sql`insert into roles (id, name) values (${id}, 'Custom')`;
  if (perms.length) await sql`insert into role_permissions ${sql(perms.map((permission) => ({ role_id: id, permission })))}`;
  await sql`delete from user_roles where user_id = (select id from users where username = ${username})`;
  await sql`insert into user_roles (user_id, role_id) select id, ${id} from users where username = ${username}`;
  return id;
}

let sa: string;
beforeEach(async () => {
  await resetData();
  await sql`delete from activity`;
  sa = await signIn("superadmin");
});

const get = (path: string, token?: string) => call("GET", path, { token });
const create = (body: unknown, token = sa) => call("POST", "/v1/roles", { token, body });
const patch = async (name: string, body: unknown, token = sa) => call("PATCH", `/v1/roles/${await idOf(name)}`, { token, body });
const del = async (name: string, token = sa) => call("DELETE", `/v1/roles/${await idOf(name)}`, { token });
const rolePage = async (qs = "") => (await (await get(`/v1/roles?${qs}`, sa)).json()) as Page<RoleDto>;
const roles = async (qs = "pageSize=100") => (await rolePage(qs)).items;
const permPage = async (qs = "") => (await (await get(`/v1/permissions?${qs}`, sa)).json()) as Page<PermissionDto>;
const perms = async (qs = "pageSize=100") => (await permPage(qs)).items;
const addPerms = (body: unknown, token = sa) => call("POST", "/v1/permissions", { token, body });
const roleOptions = async (token: string) => ((await (await get("/v1/users/roles", token)).json()) as Page<{ name: string }>).items.map((r) => r.name);

describe("GET /v1/roles and /v1/roles/{id}", () => {
  it("needs a session and role.view; Admin and Viewer don't have it", async () => {
    expect((await get("/v1/roles")).status).toBe(401);
    expect((await get("/v1/roles", await signIn("admin"))).status).toBe(403);
    expect((await get("/v1/roles", await signIn("viewer"))).status).toBe(403);
  });

  it("lists roles as a page, name A–Z by default, with user counts that match the users", async () => {
    const page = await rolePage();
    expect(page).toMatchObject({ total: 3, page: 1, pageSize: 15 });
    expect(page.items.map((r) => r.name)).toEqual(["Admin", "Superadmin", "Viewer"]);
    for (const r of page.items) {
      const [{ n }] = await sql`select count(*)::int as n from user_roles where role_id = ${r.id}`;
      expect(r.userCount).toBe(n);
    }
    expect(page.items[1]).toMatchObject({ id: await idOf("Superadmin"), locked: true, permissions: [...PERMISSIONS] });
  });

  it("sorts by permissions and users, searches the name, pages past the end empty", async () => {
    expect((await roles("sort=-permissions")).map((r) => r.name)).toEqual(["Superadmin", "Admin", "Viewer"]);
    const byUsers = await roles("sort=users");
    expect(byUsers.map((r) => r.userCount)).toEqual([...byUsers.map((r) => r.userCount)].sort((a, b) => a - b));
    expect((await roles("q=ADM")).map((r) => r.name)).toEqual(["Admin", "Superadmin"]);
    expect(await rolePage("page=2")).toMatchObject({ items: [], total: 3, page: 2 });
  });

  it("q with % and _ matches literally", async () => {
    await create({ name: "50% off_x" });
    await create({ name: "50 offsx" });
    expect((await roles("q=50%25")).map((r) => r.name)).toEqual(["50% off_x"]);
    expect((await roles("q=_x")).map((r) => r.name)).toEqual(["50% off_x"]);
    expect((await perms("q=%25")).length).toBe(0);
  });

  it.each([["pageSize=10"], ["page=1001"], ["sort=locked"], ["sort=-userCount"]])("rejects %s with 400 before the guard", async (qs) => {
    expect((await get(`/v1/roles?${qs}`)).status).toBe(400);
  });

  it("GET one role, 404 for an unknown id", async () => {
    expect(await (await get(`/v1/roles/${await idOf("Viewer")}`, sa)).json()).toMatchObject({ name: "Viewer", permissions: ["user.view", "audit.view"] });
    for (const id of [Bun.randomUUIDv7(), "role-nope", "1"]) {
      const r = await get(`/v1/roles/${id}`, sa);
      expect(r.status).toBe(404);
      expect(await code(r)).toBe("not_found");
    }
  });

  it("/v1/users/roles (user.view) answers the same names from the same source", async () => {
    await create({ name: "Auditor" });
    expect(await roleOptions(await signIn("viewer"))).toEqual(["Admin", "Auditor", "Superadmin", "Viewer"]);
    expect((await get("/v1/users/roles?q=VIEW", await signIn("viewer"))).status).toBe(200);
    expect((await get("/v1/users/roles?sort=id", sa)).status).toBe(400);
    expect((await get("/v1/users/roles")).status).toBe(401);
  });
});

describe("POST /v1/roles", () => {
  it("Admin gets 403 and nothing is created", async () => {
    expect((await create({ name: "Auditor" }, await signIn("admin"))).status).toBe(403);
    expect(await roleNames()).toHaveLength(3);
  });

  it("creates an empty role, 201, one activity entry", async () => {
    const r = await create({ name: "  Auditor " });
    expect(r.status).toBe(201);
    const dto = (await r.json()) as RoleDto;
    expect(dto).toMatchObject({ name: "Auditor", locked: false, permissions: [], userCount: 0 });
    expect(await idOf("Auditor")).toBe(dto.id);
    const a = await acts("role.create");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ targetType: "role", targetId: dto.id, targetLabel: "Auditor", after: { name: "Auditor", added: [], removed: [] } });
  });

  it("a taken name (case-insensitive) is 409 duplicate; a bad name or unknown permission is 400", async () => {
    expect(await code(await create({ name: "admin" }))).toBe("duplicate");
    expect((await create({ name: "A" })).status).toBe(400);
    expect((await create({ name: "Ok", permissions: ["user.fly"] })).status).toBe(400);
    expect((await call("POST", "/v1/roles", { token: sa, body: null })).status).toBe(400);
    expect(await roleNames()).toHaveLength(3);
  });

  it("can't create a role carrying a permission the actor lacks", async () => {
    await giveOnlyRole("admin", ["role.view", "role.create"]);
    const admin = await signIn("admin");
    expect((await create({ name: "Ops", permissions: ["role.view"] }, admin)).status).toBe(201);
    expect(await code(await create({ name: "Ops2", permissions: ["user.delete"] }, admin))).toBe("forbidden");
  });
});

describe("PATCH /v1/roles/{id}", () => {
  it("Superadmin is 409 superadmin_locked, even for the Superadmin user", async () => {
    const r = await patch("Superadmin", { name: "Root" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("superadmin_locked");
    expect(await roleNames()).toContain("Superadmin");
  });

  it("Admin without role.edit is 403 and the role is unchanged", async () => {
    expect((await patch("Viewer", { remove: ["user.view"] }, await signIn("admin"))).status).toBe(403);
    expect(await permsOf(await idOf("Viewer"))).toEqual(["user.view", "audit.view"]);
  });

  it("unknown permission or bad body is 400; unknown id is 404; taken name is 409", async () => {
    expect((await patch("Viewer", { add: ["audit.create"] })).status).toBe(400);
    expect((await patch("Viewer", { add: ["user.edit"], remove: ["user.edit"] })).status).toBe(400);
    expect((await patch("Viewer", { permissions: ["user.view"] })).status).toBe(400);
    expect((await patch("Viewer", { name: "" })).status).toBe(400);
    expect((await call("PATCH", `/v1/roles/${Bun.randomUUIDv7()}`, { token: sa, body: { name: "X1" } })).status).toBe(404);
    expect((await call("PATCH", "/v1/roles/1", { token: sa, body: { name: "X1" } })).status).toBe(404);
    expect(await code(await patch("Viewer", { name: "ADMIN" }))).toBe("duplicate");
  });

  it("no escalation: adding or removing a permission the actor lacks is 403; held ones go through", async () => {
    await giveOnlyRole("admin", ["role.view", "role.edit", "user.view"]);
    const admin = await signIn("admin");
    // Viewer = user.view + audit.view; the actor lacks audit.view and user.delete
    expect(await code(await patch("Viewer", { add: ["user.delete"] }, admin))).toBe("forbidden");
    expect(await code(await patch("Viewer", { remove: ["audit.view"] }, admin))).toBe("forbidden");
    // checked on what is asked, even when it would change nothing
    expect(await code(await patch("Viewer", { add: ["audit.view"] }, admin))).toBe("forbidden");
    expect(await permsOf(await idOf("Viewer"))).toEqual(["user.view", "audit.view"]);
    const ok = await patch("Viewer", { add: ["role.view"], remove: ["user.view"] }, admin);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as RoleDto).permissions).toEqual(["role.view", "audit.view"]);
  });

  it("after PATCH, userCount, PermissionDto.roles and the users' own permissions agree", async () => {
    const before = (await roles()).find((r) => r.name === "Viewer")!.userCount;
    const dto = (await (await patch("Viewer", { add: ["user.create", "user.view"] })).json()) as RoleDto;
    expect(dto.userCount).toBe(before);
    expect((await perms()).find((p) => p.name === "user.create")!.roles).toContain("Viewer");
    expect((await perms()).find((p) => p.name === "user.view")!.roles).toEqual(["Admin", "Superadmin", "Viewer"]);
    const [entry] = await acts("role.update");
    expect(entry).toMatchObject({ targetType: "role", targetId: await idOf("Viewer"), targetLabel: "Viewer", before: { name: "Viewer" }, after: { name: "Viewer", added: ["user.create"], removed: [] } });
  });

  it("rename carries the users along: same count, new name on their records and in the role list", async () => {
    const count = (await roles()).find((r) => r.name === "Viewer")!.userCount;
    const viewer = await signIn("viewer");
    const dto = (await (await patch("Viewer", { name: "Reader" })).json()) as RoleDto;
    expect(dto).toMatchObject({ name: "Reader", userCount: count });
    expect((await sql`select 1 from user_roles ur join roles r on r.id = ur.role_id where r.name = 'Viewer'`)).toHaveLength(0);
    // a renamed role still grants its permissions on the next request
    expect(await roleOptions(viewer)).toEqual(["Admin", "Reader", "Superadmin"]);
  });

  it("removing a permission takes effect on the holder's next request", async () => {
    await giveOnlyRole("admin", ["role.view", "role.edit"]);
    const admin = await signIn("admin");
    expect((await get("/v1/roles", admin)).status).toBe(200);
    expect((await patch("Custom", { remove: ["role.view", "role.edit"] })).status).toBe(200);
    expect((await get("/v1/roles", admin)).status).toBe(403);
  });
});

describe("PATCH applies add/remove to the current set", () => {
  it("concurrent revoke is not undone by a stale save that adds another permission", async () => {
    // two pages loaded Viewer = user.view + audit.view; the first revokes audit.view
    expect((await patch("Viewer", { remove: ["audit.view"] })).status).toBe(200);
    // the stale page only added user.create; it must not send audit.view back
    const dto = (await (await patch("Viewer", { add: ["user.create"] })).json()) as RoleDto;
    expect(dto.permissions).toEqual(["user.view", "user.create"]);
    expect((await acts("role.update")).at(-1)!.after).toEqual({ name: "Viewer", added: ["user.create"], removed: [] });
  });

  it("two concurrent PATCH add/remove on one role keep both changes", async () => {
    const id = await idOf("Viewer");
    const rs = await Promise.all([
      call("PATCH", `/v1/roles/${id}`, { token: sa, body: { add: ["role.delete"] } }),
      call("PATCH", `/v1/roles/${id}`, { token: sa, body: { remove: ["audit.view"] } }),
      call("PATCH", `/v1/roles/${id}`, { token: sa, body: { add: ["permission.create"] } }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await permsOf(id)).toEqual(["user.view", "role.view", "role.delete", "permission.view", "permission.create"]);
    const changes = (await acts("role.update")).map((a) => a.after as { added: string[]; removed: string[] });
    expect(changes.flatMap((c) => c.removed)).toEqual(["audit.view"]);
    expect(changes.flatMap((c) => c.added).sort()).toEqual(["permission.create", "permission.view", "role.delete", "role.view"]);
  });

  it("activity records only the effective change", async () => {
    await patch("Viewer", { add: ["user.view", "user.edit"], remove: ["role.view"] });
    expect((await acts("role.update"))[0]!.after).toEqual({ name: "Viewer", added: ["user.edit"], removed: [] });
  });

  it("a PATCH that changes nothing is 200 with the role and writes no activity", async () => {
    for (const body of [{}, { name: "Viewer" }, { add: ["user.view"] }, { remove: ["role.view"] }]) {
      const r = await patch("Viewer", body);
      expect(r.status).toBe(200);
      expect(((await r.json()) as RoleDto).permissions).toEqual(["user.view", "audit.view"]);
    }
    expect(await acts()).toHaveLength(0);
  });

  it("the Superadmin name can't be taken by create or rename (409 duplicate)", async () => {
    expect(await code(await create({ name: "Superadmin" }))).toBe("duplicate");
    expect(await code(await create({ name: "superadmin" }))).toBe("duplicate");
    expect(await code(await patch("Viewer", { name: "SUPERADMIN" }))).toBe("duplicate");
    expect(await roleNames()).toHaveLength(3);
  });
});

describe("DELETE /v1/roles/{id}", () => {
  it("Superadmin is 409 superadmin_locked; a role in use is 409 role_in_use; Admin is 403", async () => {
    expect((await del("Viewer", await signIn("admin"))).status).toBe(403);
    expect(await code(await del("Superadmin"))).toBe("superadmin_locked");
    const r = await del("Viewer");
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("role_in_use");
    expect(await roleNames()).toContain("Viewer");
  });

  it("deletes an unused role with one activity entry; then 404", async () => {
    const { id } = (await (await create({ name: "Temp", permissions: ["user.view"] })).json()) as RoleDto;
    expect((await call("DELETE", `/v1/roles/${id}`, { token: sa })).status).toBe(200);
    expect(await roleNames()).not.toContain("Temp");
    expect((await acts("role.delete"))[0]).toMatchObject({ targetId: id, targetLabel: "Temp", before: { name: "Temp", permissions: ["user.view"] } });
    expect((await call("DELETE", `/v1/roles/${id}`, { token: sa })).status).toBe(404);
  });
});

describe("/v1/permissions", () => {
  it("GET needs permission.view; lists the catalog with the roles holding each", async () => {
    expect((await get("/v1/permissions")).status).toBe(401);
    expect((await get("/v1/permissions", await signIn("admin"))).status).toBe(403);
    expect(await permPage()).toMatchObject({ total: PERMISSIONS.length, page: 1, pageSize: 15 });
    const list = await perms();
    expect(list.map((p) => p.name)).toEqual([...PERMISSIONS]); // default sort: catalog (module) order
    expect(list.every((p) => p.id === p.name)).toBe(true);
    expect(list.find((p) => p.name === "role.edit")!.roles).toEqual(["Superadmin"]);
    expect(list.find((p) => p.name === "audit.view")!.roles).toEqual(["Admin", "Superadmin", "Viewer"]);
  });

  it("filters by module, searches the name, sorts by name and action", async () => {
    expect((await perms("module=role")).map((p) => p.name)).toEqual(["role.view", "role.create", "role.edit", "role.delete"]);
    expect((await perms("q=CREATE")).map((p) => p.name)).toEqual(["user.create", "role.create", "permission.create"]);
    const byName = (await perms("sort=-name")).map((p) => p.name);
    expect(byName).toEqual([...byName].sort().reverse());
    expect((await perms("module=user&sort=action")).map((p) => p.name)).toEqual(["user.create", "user.delete", "user.edit", "user.view"]);
  });

  it.each([["module=billing"], ["pageSize=7"], ["sort=roles"]])("GET rejects %s with 400 before the guard", async (qs) => {
    expect((await get(`/v1/permissions?${qs}`)).status).toBe(400);
  });

  it.each([[["foo"]], [["billing.view"]], [["user."]], [["User.view"]], [["user.view.x"]], [["user.vi ew"]], [[]], [null]])("POST %j is 400", async (names) => {
    expect((await addPerms({ names })).status).toBe(400);
  });

  it("POST is 400 when the catalog would pass 500 names; nothing is added", async () => {
    const [{ n }] = await sql`select count(*)::int as n from permissions`;
    await sql`insert into permissions (name, position) select 'audit.x' || i, ${n} + i from generate_series(1, ${499 - n}) i`;
    expect((await addPerms({ names: ["audit.one", "audit.two"] })).status).toBe(400);
    expect((await sql`select count(*)::int as n from permissions`)[0].n).toBe(499);
    expect((await addPerms({ names: ["audit.one", "user.view"] })).status).toBe(200);
    expect((await sql`select count(*)::int as n from permissions`)[0].n).toBe(500);
  });

  it("concurrent POSTs can't pass 500 names", async () => {
    const [{ n }] = await sql`select count(*)::int as n from permissions`;
    await sql`insert into permissions (name, position) select 'audit.x' || i, ${n} + i from generate_series(1, ${498 - n}) i`;
    const rs = await Promise.all(["a", "b", "c", "d"].map((s) => addPerms({ names: [`audit.${s}1`, `audit.${s}2`] })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 400)).toHaveLength(3);
    expect((await sql`select count(*)::int as n from permissions`)[0].n).toBe(500);
  });

  it("POST needs permission.create; adds new names, skips existing ones, logs only the added", async () => {
    await giveOnlyRole("admin", ["permission.view"]);
    expect((await addPerms({ names: ["audit.export"] }, await signIn("admin"))).status).toBe(403);
    const r = await addPerms({ names: ["audit.export", "user.view", "audit.export"] });
    expect(await r.json()).toEqual({ created: ["audit.export"], skipped: ["user.view"] });
    expect((await perms()).find((p) => p.name === "audit.export")).toEqual({ id: "audit.export", name: "audit.export", roles: [], roleCount: 0 });
    expect((await perms()).at(-1)!.name).toBe("audit.export"); // new names go after the current last
    const entries = await acts("permission.create");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ targetId: "audit.export", targetLabel: "audit.export", after: { created: ["audit.export"] } });
  });
});

describe("a module's view comes with its other actions", () => {
  it("create and PATCH add the module's view when any other action of it is on; removing view alone keeps it", async () => {
    const c = await create({ name: "Editors", permissions: ["user.edit", "permission.create"] });
    expect(((await c.json()) as RoleDto).permissions).toEqual(["user.view", "user.edit", "permission.view", "permission.create"]);
    const p = await patch("Editors", { add: ["role.delete"], remove: ["user.view"] });
    expect(((await p.json()) as RoleDto).permissions).toEqual(["user.view", "user.edit", "role.view", "role.delete", "permission.view", "permission.create"]);
    expect((await acts("role.update")).at(-1)!.after).toEqual({ name: "Editors", added: ["role.view", "role.delete"], removed: [] });
  });

  it("the implied view counts for the escalation check", async () => {
    await giveOnlyRole("admin", ["role.view", "role.create", "audit.view", "user.edit"]);
    expect(await code(await create({ name: "Editors", permissions: ["user.edit"] }, await signIn("admin")))).toBe("forbidden"); // would carry user.view
  });
});

describe("PermissionDto: role names are capped", () => {
  it("roles lists at most 10 names, A–Z; roleCount is the real number", async () => {
    for (let i = 0; i < 12; i++) await create({ name: `Readers ${String(i).padStart(2, "0")}`, permissions: ["audit.view"] });
    const p = (await perms()).find((x) => x.name === "audit.view")!;
    expect(p.roleCount).toBe(15);
    expect(p.roles).toEqual(["Admin", "Readers 00", "Readers 01", "Readers 02", "Readers 03", "Readers 04", "Readers 05", "Readers 06", "Readers 07", "Readers 08"]);
  });
});

describe("role names in lookups are case-insensitive", () => {
  it("a rename that only changes letter case is allowed and moves the holders", async () => {
    expect((await patch("Viewer", { name: "VIEWER" })).status).toBe(200);
    const [row] = await sql`select r.name from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id where u.username = 'viewer'`;
    expect(row.name).toBe("VIEWER");
  });
});
