// Roles, the permission catalog and role grants: the logic of /v1/roles, /v1/permissions and /v1/users/roles, and the
// role reads and writes the users module makes. Every escalation check reads the actor's permissions inside the
// transaction (actorPermissions), never the request's earlier ctx.perms.
import { and, type Column, eq, ilike, inArray, like, type SQL, sql } from "drizzle-orm";
import type { Page } from "@starterkit/shared/contracts/common";
import {
  CATALOG_MAX, type CreatePermissionsResult, type CreateRoleBody, PERMISSION_ROLES_SHOWN, type PermissionDto, type PermissionListQuery, type RoleDto,
  type RoleListQuery, type RoleOption, type RoleOptionQuery, type UpdateRoleBody,
} from "@starterkit/shared/contracts/rbac";
import { type PermissionName, withViews } from "@starterkit/shared/permissions";
import { db, type Tx } from "../../kernel/db";
import { ApiError, notFound } from "../../kernel/errors";
import { xactLock } from "../../kernel/locks";
import { likeEscape, one, pageQuery, sortSql } from "../../kernel/pagination";
import { recordActivity } from "../audit";
import { actorPermissions, type Ctx } from "../auth";
import { checkPermissionGrant, checkRoleChange, inCatalogOrder, permissionDelta } from "./rules";
import { permissions, rolePermissions, roles, userRoles } from "./schema";

const DUPLICATE = () => new ApiError("duplicate", "Another role already has this name. Use a different one.");
/** A unique index refused the write (the driver error arrives wrapped by Drizzle). */
const isUniqueViolation = (e: unknown) => ((e as { cause?: { errno?: string } }).cause ?? (e as { errno?: string })).errno === "23505";

/** `q` as a case-insensitive literal substring of `column`; no `q` = no filter. */
const matches = (column: Column, q: string | undefined): SQL | undefined => (q?.trim() ? ilike(column, `%${likeEscape(q.trim())}%`) : undefined);

/**
 * Roles with their permissions (catalog order) and holder counts, through `tx` (a transaction sees its own changes),
 * and the sort keys of GET /v1/roles over them.
 */
// ponytail: aggregates all of user_roles / role_permissions per list request; fine for a few roles. Upgrade path: a denormalized counter.
// Holder counts and permission lists come from one grouped subquery each, never one query per role.
function roleSelect(tx: Tx) {
  // Each aggregate gets its own alias: Drizzle refers to a subquery's aliased field by the alias alone.
  const uc = tx.select({ roleId: userRoles.roleId, n: sql<number>`count(*)::int`.as("holders") }).from(userRoles).groupBy(userRoles.roleId).as("uc");
  const rp = tx.select({
    roleId: rolePermissions.roleId,
    perms: sql<PermissionName[]>`array_agg(${rolePermissions.permission} order by ${permissions.position})`.as("perms"),
    n: sql<number>`count(*)::int`.as("perm_count"),
  }).from(rolePermissions).innerJoin(permissions, eq(permissions.name, rolePermissions.permission)).groupBy(rolePermissions.roleId).as("rp");
  const userCount = sql<number>`coalesce(${uc.n}, 0)`;
  return {
    rows: tx.select({ id: roles.id, name: roles.name, locked: roles.locked, permissions: sql<PermissionName[]>`coalesce(${rp.perms}, '{}')`, userCount })
      .from(roles).leftJoin(uc, eq(uc.roleId, roles.id)).leftJoin(rp, eq(rp.roleId, roles.id)).$dynamic(),
    sorts: { name: sql`lower(${roles.name})`, permissions: sql`coalesce(${rp.n}, 0)`, users: userCount },
  };
}

/** One page of roles (GET /v1/roles), name A–Z unless `sort` says otherwise; `q` matches the name. */
export function rolePage(q: RoleListQuery): Promise<Page<RoleDto>> {
  const { rows, sorts } = roleSelect(db);
  const where = matches(roles.name, q.q);
  return pageQuery({ rows: rows.where(where), count: db.select(one).from(roles).where(where).$dynamic(), orderBy: sortSql(q.sort, sorts, "name", roles.id), query: q, map: (r) => r });
}

/** One page of role options (GET /v1/users/roles), name A–Z; `q` matches the name. */
export function roleOptionPage(q: RoleOptionQuery): Promise<Page<RoleOption>> {
  const where = matches(roles.name, q.q);
  return pageQuery({
    rows: db.select({ id: roles.id, name: roles.name }).from(roles).where(where).$dynamic(),
    count: db.select(one).from(roles).where(where).$dynamic(),
    orderBy: sortSql(q.sort, { name: sql`lower(${roles.name})` }, "name", roles.id),
    query: q,
    map: (r) => r,
  });
}

/** One role, through `tx` when given; null = no such role. */
export async function roleById(id: string, tx: Tx = db): Promise<RoleDto | null> {
  const [r] = await roleSelect(tx).rows.where(eq(roles.id, id));
  return r ?? null;
}

/** One page of the catalog (GET /v1/permissions), catalog order unless `sort` says otherwise; `q` matches the name, `module` is exact. */
export function permissionPage(q: PermissionListQuery): Promise<Page<PermissionDto>> {
  // The roles holding each: one grouped subquery; `names` are the first PERMISSION_ROLES_SHOWN by name.
  const h = db.select({
    permission: rolePermissions.permission,
    n: sql<number>`count(*)::int`.as("role_count"),
    names: sql<string[]>`(array_agg(${roles.name} order by lower(${roles.name}), ${roles.name}))[1:${PERMISSION_ROLES_SHOWN}]`.as("names"),
  }).from(rolePermissions).innerJoin(roles, eq(roles.id, rolePermissions.roleId)).groupBy(rolePermissions.permission).as("h");
  const where = and(matches(permissions.name, q.q), q.module ? like(permissions.name, `${likeEscape(q.module)}.%`) : undefined);
  const sorts = { module: permissions.position, name: permissions.name, action: sql`split_part(${permissions.name}, '.', 2)` };
  return pageQuery({
    rows: db.select({ name: permissions.name, roles: sql<string[]>`coalesce(${h.names}, '{}')`, roleCount: sql<number>`coalesce(${h.n}, 0)` })
      .from(permissions).leftJoin(h, eq(h.permission, permissions.name)).where(where).$dynamic(),
    count: db.select(one).from(permissions).where(where).$dynamic(),
    orderBy: sortSql(q.sort, sorts, "module", permissions.name),
    query: q,
    map: (r) => ({ id: r.name, name: r.name, roles: r.roles, roleCount: r.roleCount }),
  });
}

/** New role, empty unless `permissions` is given (plus each module's view they imply); it may carry only permissions the actor holds. */
export async function createRole(ctx: Ctx, b: CreateRoleBody): Promise<RoleDto> {
  const perms = inCatalogOrder([...withViews(b.permissions)]);
  return db.transaction(async (tx) => {
    // The actor's permissions are read now, not taken from the request's start: a revoke committed since must count.
    if (checkPermissionGrant(await actorPermissions(tx, ctx.user.id), perms)) {
      throw new ApiError("forbidden", "Your role doesn't hold every permission you picked. Leave those out, or ask an administrator who has them.");
    }
    const id = Bun.randomUUIDv7();
    try {
      await tx.insert(roles).values({ id, name: b.name });
    } catch (e) {
      throw isUniqueViolation(e) ? DUPLICATE() : e; // the only unique key a new id can hit is lower(name)
    }
    if (perms.length) await tx.insert(rolePermissions).values(perms.map((permission) => ({ roleId: id, permission })));
    await recordActivity(tx, ctx, { action: "role.create", target: { type: "role", id, label: b.name }, after: { name: b.name, added: perms, removed: [] } });
    return (await roleById(id, tx))!;
  });
}

/** Locks role `id` for the transaction; its row, or 404. */
async function lockRole(tx: Tx, id: string): Promise<{ id: string; name: string; locked: boolean }> {
  const [r] = await tx.select({ id: roles.id, name: roles.name, locked: roles.locked }).from(roles).where(eq(roles.id, id)).for("update");
  if (!r) throw notFound("role");
  return r;
}

/**
 * Rename and/or apply `add` / `remove` to the role's current permissions; a module's view stays while any other action
 * of it is on (withViews). Superadmin is locked. No escalation: every permission asked to be added or removed, and any
 * view the change implies, must be one the actor holds. A rename (letter case included) moves the holders by itself
 * (user_roles points at the id). Nothing to change → the role, no activity entry.
 */
export async function updateRole(ctx: Ctx, id: string, b: UpdateRoleBody): Promise<RoleDto> {
  return db.transaction(async (tx) => {
    // The row lock queues PATCHes of one role, so the view rule sees the set the previous one left; the changes
    // themselves are INSERT … ON CONFLICT DO NOTHING / DELETE of just the difference, never a rewrite of the set.
    const r = await lockRole(tx, id);
    const stop = checkRoleChange(r, "edit", 0);
    if (stop) throw new ApiError(stop);
    const current = (await tx.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, id))).map((x) => x.p as PermissionName);
    // Read after the lock: a PATCH of the actor's own role that committed first is seen here.
    const { name = r.name, add = [], remove = [] } = b;
    const { toAdd, toRemove } = permissionDelta(current, add, remove);
    if (checkPermissionGrant(await actorPermissions(tx, ctx.user.id), [...add, ...remove, ...toAdd])) {
      throw new ApiError("forbidden", "You can only add or remove permissions your own role holds. Ask an administrator who has them.");
    }
    if (name === r.name && !toAdd.length && !toRemove.length) return (await roleById(id, tx))!;
    if (name !== r.name) {
      try {
        await tx.update(roles).set({ name }).where(eq(roles.id, id));
      } catch (e) {
        throw isUniqueViolation(e) ? DUPLICATE() : e;
      }
    }
    const done = (xs: { p: string }[]) => inCatalogOrder(xs.map((x) => x.p as PermissionName));
    const added = toAdd.length
      ? done(await tx.insert(rolePermissions).values(toAdd.map((permission) => ({ roleId: id, permission }))).onConflictDoNothing().returning({ p: rolePermissions.permission }))
      : [];
    const removed = toRemove.length
      ? done(await tx.delete(rolePermissions).where(and(eq(rolePermissions.roleId, id), inArray(rolePermissions.permission, toRemove))).returning({ p: rolePermissions.permission }))
      : [];
    await recordActivity(tx, ctx, { action: "role.update", target: { type: "role", id, label: name }, before: { name: r.name }, after: { name, added, removed } });
    return (await roleById(id, tx))!;
  });
}

/** Deletes a role nobody holds; Superadmin is locked. */
export async function deleteRole(ctx: Ctx, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    // The lock also holds back a concurrent assignment (its foreign key check needs a share lock on this row).
    const r = await lockRole(tx, id);
    const stop = checkRoleChange(r, "delete", await tx.$count(userRoles, eq(userRoles.roleId, id)));
    if (stop) throw new ApiError(stop);
    const perms = (await tx.select({ p: rolePermissions.permission }).from(rolePermissions)
      .innerJoin(permissions, eq(permissions.name, rolePermissions.permission)).where(eq(rolePermissions.roleId, id)).orderBy(permissions.position)).map((x) => x.p);
    await tx.delete(roles).where(eq(roles.id, id));
    await recordActivity(tx, ctx, { action: "role.delete", target: { type: "role", id, label: r.name }, before: { name: r.name, permissions: perms } });
  });
}

/**
 * Adds `<module>.<action>` names (deduplicated) to the catalog; names already in it are skipped. Roles can't hold an
 * added name yet (role bodies accept PermissionName only).
 */
// ponytail: one advisory lock serializes every catalog write; fine for an admin-only action that is rare.
export async function createPermissions(ctx: Ctx, names: string[]): Promise<CreatePermissionsResult> {
  return db.transaction(async (tx) => {
    await xactLock(tx, "catalog");
    const [{ n, last }] = await tx.select({ n: sql<number>`count(*)::int`, last: sql<number>`coalesce(max(${permissions.position}), -1)::int` }).from(permissions) as [{ n: number; last: number }];
    const known = new Set((await tx.select({ name: permissions.name }).from(permissions).where(inArray(permissions.name, names))).map((x) => x.name));
    const fresh = names.filter((x) => !known.has(x));
    if (n + fresh.length > CATALOG_MAX) throw new ApiError("bad_request", `The list can hold at most ${CATALOG_MAX} permissions. Add fewer names.`);
    const made = new Set<string>();
    if (fresh.length) {
      const rows = await tx.insert(permissions).values(fresh.map((name, i) => ({ name, position: last + 1 + i }))).onConflictDoNothing().returning({ name: permissions.name });
      for (const x of rows) made.add(x.name);
    }
    const created = names.filter((x) => made.has(x));
    if (created.length) {
      await recordActivity(tx, ctx, { action: "permission.create", target: { type: "permission", id: created.join(","), label: created.join(", ") }, after: { created } });
    }
    return { created, skipped: names.filter((x) => !made.has(x)) };
  });
}

export type RoleRef = { id: string; name: string; permissions: PermissionName[] };

/**
 * Roles matching `where` with their permissions, A–Z. The rows are share-locked first, in a statement of their own: a
 * role edit or delete in progress finishes before the read (a deleted role is then simply missing), and none starts
 * until this transaction ends. Role routes never wait on user rows or the Superadmin lock, so this can't deadlock.
 */
async function lockedRoles(tx: Tx, where: SQL): Promise<RoleRef[]> {
  await tx.select(one).from(roles).where(where).for("share");
  return tx.select({
    id: roles.id, name: roles.name,
    permissions: sql<PermissionName[]>`array(${tx.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, roles.id))})`,
  }).from(roles).where(where).orderBy(roles.name);
}

/** Roles named in `names` (any letter case), share-locked, keyed by lower-case name. */
export async function rolesByName(tx: Tx, names: readonly string[]): Promise<Map<string, RoleRef>> {
  if (!names.length) return new Map();
  const rows = await lockedRoles(tx, inArray(sql`lower(${roles.name})`, [...new Set(names.map((n) => n.toLowerCase()))]));
  return new Map(rows.map((r) => [r.name.toLowerCase(), r]));
}

/** The roles `userId` holds now, by id (a rename since the user was read doesn't matter), share-locked, A–Z. */
export const rolesOfUser = (tx: Tx, userId: string): Promise<RoleRef[]> =>
  lockedRoles(tx, inArray(roles.id, tx.select({ id: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId))));

/** Gives user `userId` the roles `roleIds` (none held yet). */
export async function grantRoles(tx: Tx, userId: string, roleIds: string[]): Promise<void> {
  if (roleIds.length) await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId })));
}

/** Takes the roles `roleIds` from user `userId`. */
export async function revokeRoles(tx: Tx, userId: string, roleIds: string[]): Promise<void> {
  if (roleIds.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.roleId, roleIds)));
}
