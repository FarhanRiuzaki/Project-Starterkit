import { beforeEach, describe, expect, it } from "bun:test";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { seedSystem } from "../../../../db/seed/system";
import { client, db } from "../../../../kernel/db";
import { activity } from "../../../audit";
import { users } from "../../../users";
import { permissions, rolePermissions, roles, userRoles } from "../../schema";
import { call, resetData, signIn } from "../../../../../test/helpers/app";

beforeEach(resetData);
const roleId = async (name: string) => (await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)))[0]!.id;
const grants = async (name: string) => (await db.select({ permission: rolePermissions.permission }).from(rolePermissions)
  .where(eq(rolePermissions.roleId, await roleId(name))).orderBy(asc(rolePermissions.permission))).map(row => row.permission);
const context = async (token: string): Promise<string[]> => {
  const response = await call("GET", "/v1/auth/context", { token });
  expect(response.status).toBe(200);
  return ((await response.json()) as { permissions: string[] }).permissions.sort();
};
const add = (token: string, names: string[]) => call("POST", "/v1/permissions", { token, body: { names } });

/** These regressions exercise the existing official writers, not an authorization bypass for a role label. */
describe("automatic Superadmin catalog grants", () => {
  it("the same live session sees new permissions next request, duplicates do nothing and existing non-SA roles stay unchanged", async () => {
    const sa = await signIn("superadmin"), admin = await signIn("admin"), viewer = await signIn("viewer");
    const other = (await db.select({ id: users.id }).from(users).where(eq(users.username, "twofa")))[0]!;
    await db.insert(userRoles).values({ userId: other.id, roleId: await roleId("Superadmin") });
    const secondSa = await signIn("twofa");
    const [beforeSa, beforeAdmin, beforeViewer] = await Promise.all([context(sa), context(admin), context(viewer)]);
    expect(await context(secondSa)).toEqual(beforeSa);
    const names = ["user.batch_a_export", "role.batch_a_review"];
    const made = await add(sa, [...names, names[0]!]);
    expect(made.status).toBe(200);
    expect(await made.json()).toEqual({ created: names, skipped: [] });
    expect(await context(sa)).toEqual([...beforeSa, ...names].sort());
    expect(await context(secondSa)).toEqual([...beforeSa, ...names].sort());
    expect(await context(admin)).toEqual(beforeAdmin);
    expect(await context(viewer)).toEqual(beforeViewer);
    expect(await grants("Admin")).toEqual(beforeAdmin);
    expect(await grants("Viewer")).toEqual(beforeViewer);
    const repeated = await add(sa, names);
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toEqual({ created: [], skipped: names });
    expect(await db.$count(activity, eq(activity.action, "permission.create"))).toBe(1);
    for (const permission of names) expect(await db.$count(rolePermissions, eq(rolePermissions.permission, permission))).toBe(1);
  });

  it("a non-Superadmin catalog creator does not auto-grant itself or other non-SA roles", async () => {
    const id = Bun.randomUUIDv7();
    await db.insert(roles).values({ id, name: "Catalog writer" });
    await db.insert(rolePermissions).values(["user.view", "permission.view", "permission.create"].map(permission => ({ roleId: id, permission })));
    const actor = (await db.select({ id: users.id }).from(users).where(eq(users.username, "admin")))[0]!;
    await db.delete(userRoles).where(eq(userRoles.userId, actor.id));
    await db.insert(userRoles).values({ userId: actor.id, roleId: id });
    const token = await signIn("admin"), sa = await signIn("superadmin"), viewer = await signIn("viewer");
    const before = await context(token), viewerBefore = await context(viewer);
    expect((await add(token, ["user.batch_a_writer"])).status).toBe(200);
    expect(await context(sa)).toContain("user.batch_a_writer");
    expect(await context(token)).toEqual(before);
    expect(await context(viewer)).toEqual(viewerBefore);
    expect((await db.select().from(rolePermissions).where(eq(rolePermissions.permission, "user.batch_a_writer"))).map(row => row.roleId)).toEqual([await roleId("Superadmin")]);
  });

  it("system seed repairs grants for an existing custom catalog idempotently without overwriting edited Admin or Viewer", async () => {
    const sa = await signIn("superadmin");
    const names = ["user.batch_a_existing", "project.batch_a_existing"];
    const last = (await db.select({ last: sql<number>`max(${permissions.position})::int` }).from(permissions))[0]!.last;
    await db.insert(permissions).values(names.map((name, index) => ({ name, position: last! + index + 1 })));
    await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, await roleId("Superadmin")), eq(rolePermissions.permission, "project.delete")));
    await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, await roleId("Admin")), eq(rolePermissions.permission, "user.delete")));
    await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, await roleId("Viewer")), eq(rolePermissions.permission, "audit.view")));
    await db.insert(rolePermissions).values([
      { roleId: await roleId("Admin"), permission: names[0]! },
      { roleId: await roleId("Viewer"), permission: names[1]! },
    ]);
    const [admin, viewer] = await Promise.all([grants("Admin"), grants("Viewer")]);
    const catalog = (await db.select({ name: permissions.name }).from(permissions)).map(row => row.name).sort();
    await seedSystem(db, {});
    expect(await grants("Superadmin")).toEqual(catalog);
    expect(await context(sa)).toEqual(catalog);
    expect(await grants("Admin")).toEqual(admin);
    expect(await grants("Viewer")).toEqual(viewer);
    const count = await db.$count(rolePermissions);
    await seedSystem(db, {});
    expect(await db.$count(rolePermissions)).toBe(count);
    expect(await grants("Superadmin")).toEqual(catalog);
    expect(await grants("Admin")).toEqual(admin);
    expect(await grants("Viewer")).toEqual(viewer);
  });

  it("overlapping concurrent registrations create and auto-grant their union exactly once", async () => {
    const sa = await signIn("superadmin");
    const names = ["user.batch_a_shared", "user.batch_a_left", "user.batch_a_right"];
    const [admin, viewer] = await Promise.all([grants("Admin"), grants("Viewer")]);
    const responses = await Promise.all([add(sa, [names[0]!, names[1]!]), add(sa, [names[0]!, names[2]!])]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map(response => response.json() as Promise<{ created: string[]; skipped: string[] }>));
    expect(bodies.flatMap(body => body.created).sort()).toEqual([...names].sort());
    expect(bodies.flatMap(body => body.skipped)).toEqual([names[0]!]);
    const catalog = await db.select().from(permissions).where(inArray(permissions.name, names));
    expect(catalog).toHaveLength(3);
    expect(new Set(catalog.map(row => row.position)).size).toBe(3);
    const catalogSa = await roleId("Superadmin");
    const held = await db.select().from(rolePermissions).where(inArray(rolePermissions.permission, names));
    expect(held).toHaveLength(3);
    expect(held.every(row => row.roleId === catalogSa)).toBe(true);
    expect(await grants("Admin")).toEqual(admin);
    expect(await grants("Viewer")).toEqual(viewer);
    expect((await context(sa)).filter(name => names.includes(name)).sort()).toEqual([...names].sort());
    const entries = await db.select({ after: activity.after }).from(activity).where(eq(activity.action, "permission.create"));
    expect(entries).toHaveLength(2);
    expect(entries.flatMap(entry => (entry.after as { created: string[] }).created).sort()).toEqual([...names].sort());
  });

  for (const [stage, table, condition] of [
    ["grant", "role_permissions", "new.permission = 'user.batch_a_rollback'"],
    ["audit", "activity", "new.action = 'permission.create' and new.target_id = 'user.batch_a_rollback'"],
  ] as const) it(`a forced ${stage} failure rolls back the catalog, automatic grant and activity atomically`, async () => {
    const sa = await signIn("superadmin");
    const before = await context(sa);
    // Fixed test-only DDL, on the isolated *_test database. No production injection seam or migration.
    await client.unsafe(`create function batch_a_reject_registration() returns trigger language plpgsql as $$ begin if ${condition} then raise exception 'batch A test-only registration failure'; end if; return new; end; $$`);
    try {
      await client.unsafe(`create trigger batch_a_reject_registration before insert on ${table} for each row execute function batch_a_reject_registration()`);
      const response = await add(sa, ["user.batch_a_rollback"]);
      expect(response.status).toBe(500);
      expect((await response.json() as { error: { code: string } }).error.code).toBe("internal");
      expect(await db.$count(permissions, eq(permissions.name, "user.batch_a_rollback"))).toBe(0);
      expect(await db.$count(rolePermissions, eq(rolePermissions.permission, "user.batch_a_rollback"))).toBe(0);
      expect(await db.$count(activity, eq(activity.action, "permission.create"))).toBe(0);
      expect(await context(sa)).toEqual(before);
    } finally {
      await client.unsafe(`drop trigger if exists batch_a_reject_registration on ${table}`);
      await client.unsafe("drop function if exists batch_a_reject_registration()");
    }
    // Recover with the same session and fixture, proving the failed transaction left no residue.
    const recovered = await add(sa, ["user.batch_a_rollback"]);
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual({ created: ["user.batch_a_rollback"], skipped: [] });
    expect(await db.$count(permissions, eq(permissions.name, "user.batch_a_rollback"))).toBe(1);
    const recoveredGrants = await db.select().from(rolePermissions).where(eq(rolePermissions.permission, "user.batch_a_rollback"));
    expect(recoveredGrants.map(row => row.roleId)).toEqual([await roleId("Superadmin")]);
    expect(await context(sa)).toEqual([...before, "user.batch_a_rollback"].sort());
    const recoveredEntries = await db.select({ after: activity.after }).from(activity).where(eq(activity.action, "permission.create"));
    expect(recoveredEntries).toEqual([{ after: { created: ["user.batch_a_rollback"] } }]);
  });
});
