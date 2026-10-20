import type { ErrorCode } from "@starterkit/shared/contracts/common";
import { PERMISSIONS, withViews } from "@starterkit/shared/permissions";

/** A role may not be changed when locked (Superadmin), nor deleted while `holders` users still have it. */
export function checkRoleChange(role: { name: string; locked: boolean }, change: "edit" | "delete", holders: number): ErrorCode | null {
  if (role.locked) return "superadmin_locked";
  return change === "delete" && holders > 0 ? "role_in_use" : null;
}

/** No privilege escalation: an actor may grant, remove or hand out only permissions they hold themselves. */
export function checkPermissionGrant(actorPerms: ReadonlySet<string>, changed: readonly string[]): ErrorCode | null {
  return changed.every((p) => actorPerms.has(p)) ? null : "forbidden";
}

/** An actor may add or remove a role only when they hold every permission it carries. */
export function checkRoleGrant(actorPerms: ReadonlySet<string>, role: { permissions: readonly string[] }): ErrorCode | null {
  return checkPermissionGrant(actorPerms, role.permissions);
}

/**
 * Deduplicated, in catalog order (stable lists for storage, answers and the activity log): the app's PermissionNames in
 * their order, then names added to the catalog, A–Z.
 */
export const inCatalogOrder = (ps: readonly string[]): string[] => {
  const app = new Set<string>(PERMISSIONS);
  return [...PERMISSIONS.filter((p) => ps.includes(p)), ...[...new Set(ps.filter((p) => !app.has(p)))].sort()];
};

/**
 * A role PATCH as the difference to apply to its `current` permissions: `remove`, then `add`, with each module's view
 * kept while any other action of it is on (withViews). Both lists in catalog order.
 */
export function permissionDelta(
  current: readonly string[], add: readonly string[], remove: readonly string[],
): { toAdd: string[]; toRemove: string[] } {
  const next = withViews([...current.filter((p) => !remove.includes(p)), ...add]);
  return { toAdd: inCatalogOrder([...next].filter((p) => !current.includes(p))), toRemove: inCatalogOrder(current.filter((p) => !next.has(p))) };
}
