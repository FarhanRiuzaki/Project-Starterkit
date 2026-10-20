// /v1/roles, /v1/permissions and /v1/users/roles: port of apps/web/src/app/api/{roles,permissions,users/roles}.
import { Hono } from "hono";
import { CATALOG_MAX, CreatePermissionsBody, type CreatePermissionsResult, CreateRoleBody, PermissionListQuery, RoleListQuery, RoleOptionQuery, UpdateRoleBody } from "@starterkit/shared/contracts/rbac";
import { type PermissionName, withViews } from "@starterkit/shared/permissions";
import { recordActivity } from "../audit/record";
import { sql } from "../db/client";
import { ApiError, notFound } from "../http/errors";
import { actorPermissions } from "../auth/sessions";
import { guard } from "../http/guard";
import type { AppEnv } from "../http/middleware";
import { body, idParam, query } from "../http/parse";
import { permissionPage, roleById, roleOptionPage, rolePage } from "./queries";
import { checkPermissionGrant, checkRoleChange, inCatalogOrder } from "./rules";

export const rbacRoutes = new Hono<AppEnv>();

const DUPLICATE = () => new ApiError("duplicate", "Another role already has this name. Use a different one.");
/** Serializes catalog writes (the 500-name cap). */
const CATALOG_LOCK = 50_001;
const isUniqueViolation = (e: unknown) => (e as { errno?: string }).errno === "23505";

/** Role options for the user filter and forms, under user.view: one page of { id, name }, name A–Z; `q` matches the name. */
rbacRoutes.get("/users/roles", async (c) => {
  const q = query(c, RoleOptionQuery);
  await guard(c, "user.view");
  return c.json(await roleOptionPage(q));
});

/** One page of roles, name A–Z unless `sort` says otherwise; `q` matches the name. */
rbacRoutes.get("/roles", async (c) => {
  const q = query(c, RoleListQuery);
  await guard(c, "role.view");
  return c.json(await rolePage(q));
});

/** New role, empty unless `permissions` is given (plus each module's view they imply); it may carry only permissions the actor holds. */
rbacRoutes.post("/roles", async (c) => {
  const ctx = await guard(c, "role.create");
  const b = await body(c, CreateRoleBody);
  const permissions = inCatalogOrder([...withViews(b.permissions)]);
  const role = await sql.begin(async (tx) => {
    // The actor's permissions are read now, not taken from the request's start: a revoke committed since must count.
    if (checkPermissionGrant(await actorPermissions(tx, ctx.user.id), permissions)) {
      throw new ApiError("forbidden", "Your role doesn't hold every permission you picked. Leave those out, or ask an administrator who has them.");
    }
    const id = Bun.randomUUIDv7();
    const [made] = await tx`insert into roles (id, name) values (${id}, ${b.name}) on conflict ((lower(name))) do nothing returning id`;
    if (!made) throw DUPLICATE();
    if (permissions.length) await tx`insert into role_permissions ${tx(permissions.map((permission) => ({ role_id: id, permission })))}`;
    await recordActivity(tx, ctx, { action: "role.create", target: { type: "role", id, label: b.name }, after: { name: b.name, added: permissions, removed: [] } });
    return roleById(tx, id);
  });
  return c.json(role, 201);
});

rbacRoutes.get("/roles/:id", async (c) => {
  await guard(c, "role.view");
  const role = await roleById(sql, idParam(c, "id", "role"));
  if (!role) throw notFound("role");
  return c.json(role);
});

/**
 * Rename and/or apply `add` / `remove` to the role's current permissions; a module's view stays while any other action
 * of it is on (withViews). Superadmin is locked. No escalation: every permission asked to be added or removed, and any
 * view the change implies, must be one the actor holds. A rename (letter case included) moves the holders by itself
 * (user_roles points at the id). Nothing to change → 200 with the role, no activity entry.
 */
rbacRoutes.patch("/roles/:id", async (c) => {
  const ctx = await guard(c, "role.edit");
  const b = await body(c, UpdateRoleBody);
  const id = idParam(c, "id", "role");
  const role = await sql.begin(async (tx) => {
    // The row lock queues PATCHes of one role, so the view rule sees the set the previous one left; the changes
    // themselves are INSERT … ON CONFLICT DO NOTHING / DELETE of just the difference, never a rewrite of the set.
    const [r] = await tx`select id, name, locked from roles where id = ${id} for update`;
    if (!r) throw notFound("role");
    const stop = checkRoleChange(r, "edit", 0);
    if (stop) throw new ApiError(stop);
    const current = (await tx`select permission from role_permissions where role_id = ${id}`).map((x: { permission: PermissionName }) => x.permission);
    // Read after the lock: a PATCH of the actor's own role that committed first is seen here.
    const { name = r.name, add = [], remove = [] } = b;
    const next = withViews([...current.filter((p: PermissionName) => !remove.includes(p)), ...add]);
    const toAdd = inCatalogOrder([...next].filter((p) => !current.includes(p)));
    const toRemove = inCatalogOrder(current.filter((p: PermissionName) => !next.has(p)));
    if (checkPermissionGrant(await actorPermissions(tx, ctx.user.id), [...add, ...remove, ...toAdd])) {
      throw new ApiError("forbidden", "You can only add or remove permissions your own role holds. Ask an administrator who has them.");
    }
    if (name === r.name && !toAdd.length && !toRemove.length) return roleById(tx, id);
    if (name !== r.name) {
      try {
        await tx`update roles set name = ${name} where id = ${id}`;
      } catch (e) {
        throw isUniqueViolation(e) ? DUPLICATE() : e;
      }
    }
    const rows = (xs: { permission: PermissionName }[]) => inCatalogOrder(xs.map((x) => x.permission));
    const added = toAdd.length ? rows(await tx`insert into role_permissions ${tx(toAdd.map((permission) => ({ role_id: id, permission })))} on conflict do nothing returning permission`) : [];
    const removed = toRemove.length ? rows(await tx`delete from role_permissions where role_id = ${id} and permission in ${tx(toRemove)} returning permission`) : [];
    await recordActivity(tx, ctx, { action: "role.update", target: { type: "role", id, label: name }, before: { name: r.name }, after: { name, added, removed } });
    return roleById(tx, id);
  });
  return c.json(role);
});

rbacRoutes.delete("/roles/:id", async (c) => {
  const ctx = await guard(c, "role.delete");
  const id = idParam(c, "id", "role");
  await sql.begin(async (tx) => {
    // The lock also holds back a concurrent assignment (its foreign key check needs a share lock on this row).
    const [r] = await tx`select id, name, locked from roles where id = ${id} for update`;
    if (!r) throw notFound("role");
    const [{ n }] = await tx`select count(*)::int as n from user_roles where role_id = ${id}`;
    const stop = checkRoleChange(r, "delete", n);
    if (stop) throw new ApiError(stop);
    const permissions = (await tx`select x.permission from role_permissions x join permissions p on p.name = x.permission where x.role_id = ${id} order by p.position`).map((x: { permission: string }) => x.permission);
    await tx`delete from roles where id = ${id}`;
    await recordActivity(tx, ctx, { action: "role.delete", target: { type: "role", id, label: r.name }, before: { name: r.name, permissions } });
  });
  return c.json({ ok: true });
});

/** One page of the catalog, catalog order unless `sort` says otherwise; `q` matches the name, `module` is exact. */
rbacRoutes.get("/permissions", async (c) => {
  const q = query(c, PermissionListQuery);
  await guard(c, "permission.view");
  return c.json(await permissionPage(q));
});

/**
 * Add `<module>.<action>` names to the catalog; names already in it are skipped. Roles can't hold an added name yet
 * (role bodies accept PermissionName only).
 */
// ponytail: one advisory lock serializes every catalog write; fine for an admin-only action that is rare.
rbacRoutes.post("/permissions", async (c) => {
  const ctx = await guard(c, "permission.create");
  const names = [...new Set((await body(c, CreatePermissionsBody)).names)];
  const res = await sql.begin(async (tx): Promise<CreatePermissionsResult> => {
    await tx`select pg_advisory_xact_lock(${CATALOG_LOCK})`;
    const [{ n, last }] = await tx`select count(*)::int as n, coalesce(max(position), -1)::int as last from permissions`;
    const known = new Set((await tx`select name from permissions where name in ${tx(names)}`).map((x: { name: string }) => x.name));
    const fresh = names.filter((x) => !known.has(x));
    if (n + fresh.length > CATALOG_MAX) throw new ApiError("bad_request", `The list can hold at most ${CATALOG_MAX} permissions. Add fewer names.`);
    const made = new Set<string>();
    if (fresh.length) {
      const rows = await tx`insert into permissions ${tx(fresh.map((name, i) => ({ name, position: last + 1 + i })))} on conflict do nothing returning name`;
      for (const x of rows) made.add(x.name);
    }
    const created = names.filter((x) => made.has(x));
    if (created.length) {
      await recordActivity(tx, ctx, { action: "permission.create", target: { type: "permission", id: created.join(","), label: created.join(", ") }, after: { created } });
    }
    return { created, skipped: names.filter((x) => !made.has(x)) };
  });
  return c.json(res);
});
