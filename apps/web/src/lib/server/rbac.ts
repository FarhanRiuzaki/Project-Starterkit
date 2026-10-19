import type { PermissionDto, RoleDto } from "@/lib/shared/contracts/rbac";
import { PERMISSIONS, type PermissionName } from "@/lib/shared/permissions";
import { db, type RoleRecord } from "./mock/db";

/** A role with the number of users holding it (users store role names). */
export function toRoleDto(r: RoleRecord): RoleDto {
  let userCount = 0;
  for (const u of db().users.values()) if (u.roles.includes(r.name)) userCount++;
  return { ...r, permissions: [...r.permissions], userCount };
}

/** Every role, in store order. GET /api/roles answers this; /api/users/roles answers its names. */
export const listRoles = (): RoleDto[] => [...db().roles.values()].map(toRoleDto);

/** The catalog with the roles holding each permission. */
export function listPermissions(): PermissionDto[] {
  const roles = [...db().roles.values()];
  return [...db().permissionCatalog].map((name) => ({ name, roles: roles.filter((r) => (r.permissions as string[]).includes(name)).map((r) => r.name) }));
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
