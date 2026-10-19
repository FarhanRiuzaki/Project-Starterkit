import type { Page } from "@/lib/shared/contracts/common";
import type { PermissionDto, PermissionListQuery, RoleDto, RoleListQuery } from "@/lib/shared/contracts/rbac";
import { PERMISSIONS, type PermissionName } from "@/lib/shared/permissions";
import { db, type RoleRecord } from "./mock/db";
import { paginate, type Sorters } from "./paginate";

/** A role with the number of users holding it (users store role names). */
export function toRoleDto(r: RoleRecord): RoleDto {
  let userCount = 0;
  for (const u of db().users.values()) if (u.roles.includes(r.name)) userCount++;
  return { ...r, permissions: [...r.permissions], userCount };
}

/** Every role with its user count, in store order; GET /api/roles filters, sorts and pages it. */
export const listRoles = (): RoleDto[] => [...db().roles.values()].map(toRoleDto);

export const ROLE_SORTERS: Sorters<RoleDto> = { name: (r) => r.name, permissions: (r) => r.permissions.length, users: (r) => r.userCount };

/** The catalog, in catalog order, with the roles holding each permission. */
export function listPermissions(): PermissionDto[] {
  const roles = [...db().roles.values()];
  return [...db().permissionCatalog].map((name) => ({ id: name, name, roles: roles.filter((r) => (r.permissions as string[]).includes(name)).map((r) => r.name) }));
}

/** Sorters for `rows` as listPermissions returns them: `module` keeps that catalog order. */
export function permissionSorters(rows: readonly PermissionDto[]): Sorters<PermissionDto> {
  const at = new Map(rows.map((p, i) => [p.id, i]));
  return { module: (p) => at.get(p.id) ?? null, name: (p) => p.name, action: (p) => p.name.split(".")[1] ?? "" };
}

// Read functions: one per resource, called by its GET route and by the page's server prefetch (lib/server/prefetch.tsx).

/** One page of roles (GET /api/roles), name A–Z unless `sort` says otherwise; `q` matches the name. */
export function rolePage(q: RoleListQuery): Page<RoleDto> {
  const needle = q.q?.trim().toLowerCase();
  return paginate(listRoles().filter((r) => !needle || r.name.toLowerCase().includes(needle)), q, ROLE_SORTERS, "name");
}

/** One role (GET /api/roles/[id]); null = no such role. */
export function roleById(id: string): RoleDto | null {
  const r = db().roles.get(id);
  return r ? toRoleDto(r) : null;
}

/** One page of the catalog (GET /api/permissions), catalog order unless `sort` says otherwise; `q` matches the name, `module` is exact. */
export function permissionPage(q: PermissionListQuery): Page<PermissionDto> {
  const all = listPermissions();
  const needle = q.q?.trim().toLowerCase();
  const rows = all.filter((p) => (!needle || p.name.includes(needle)) && (!q.module || p.name.startsWith(`${q.module}.`)));
  return paginate(rows, q, permissionSorters(all), "module");
}

/** Another role (not `exceptId`) already has this name, compared case-insensitively. */
export function roleNameTaken(name: string, exceptId?: string): boolean {
  const n = name.toLowerCase();
  return [...db().roles.values()].some((r) => r.id !== exceptId && r.name.toLowerCase() === n);
}

/** Deduplicated, in catalog order (stable lists for storage, answers and the activity log). */
export const inCatalogOrder = (ps: readonly PermissionName[]): PermissionName[] => PERMISSIONS.filter((p) => ps.includes(p));

/** Users hold role names, so a rename moves every holder to the new name. */
export function renameRoleOnUsers(from: string, to: string): void {
  for (const u of db().users.values()) if (u.roles.includes(from)) u.roles = u.roles.map((r) => (r === from ? to : r));
}
