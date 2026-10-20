import type { ErrorCode } from "@starterkit/shared/contracts/common";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";

/** A role may not be changed when locked (Superadmin), nor deleted while `holders` users still have it. */
export function checkRoleChange(role: { name: string; locked: boolean }, change: "edit" | "delete", holders: number): ErrorCode | null {
  if (role.locked) return "superadmin_locked";
  return change === "delete" && holders > 0 ? "role_in_use" : null;
}

/** No privilege escalation: an actor may grant, remove or hand out only permissions they hold themselves. */
export function checkPermissionGrant(actorPerms: ReadonlySet<PermissionName>, changed: readonly PermissionName[]): ErrorCode | null {
  return changed.every((p) => actorPerms.has(p)) ? null : "forbidden";
}

/** An actor may add or remove a role only when they hold every permission it carries. */
export function checkRoleGrant(actorPerms: ReadonlySet<PermissionName>, role: { permissions: readonly PermissionName[] }): ErrorCode | null {
  return checkPermissionGrant(actorPerms, role.permissions);
}

/** Deduplicated, in catalog order (stable lists for storage, answers and the activity log). */
export const inCatalogOrder = (ps: readonly PermissionName[]): PermissionName[] => PERMISSIONS.filter((p) => ps.includes(p));
