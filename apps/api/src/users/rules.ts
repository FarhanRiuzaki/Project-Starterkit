// User rules, moved from the web mock's rules.ts (deleted in Task 9). Effective permissions are SQL now (auth/sessions.ts
// permsOf), so the rules take permission sets and a Superadmin count instead of the store.
import type { BulkResult, ErrorCode } from "@starterkit/shared/contracts/common";
import type { PermissionName } from "@starterkit/shared/permissions";

/** The role whose last active holder must stay (locked: it can't be renamed). */
export const SUPERADMIN = "Superadmin";

export type UserChange = { kind: "deactivate" | "delete" | "setRoles"; roles?: string[] };

/**
 * Not on yourself; not the last active Superadmin. `otherSupers` counts the other active Superadmins; it is called
 * only when the change would take `target` out of that count (the caller counts under a lock).
 */
export async function checkUserChange(
  actorId: string,
  target: { id: string; isActive: boolean; roles: readonly string[] },
  change: UserChange,
  otherSupers: () => Promise<number>,
): Promise<ErrorCode | null> {
  if (actorId === target.id) return "self_action";
  // setRoles without `roles` means "no roles at all" (it loses Superadmin too); deactivate and delete always lose it.
  const losesSuper = change.kind === "setRoles" ? !(change.roles ?? []).includes(SUPERADMIN) : true;
  if (target.isActive && target.roles.includes(SUPERADMIN) && losesSuper && (await otherSupers()) === 0) return "last_superadmin";
  return null;
}

/**
 * Actor rank: an actor may act on another user (edit, status, password reset, sessions, delete, bulk) only when they
 * hold every permission that user has, so a `user.edit` holder can't take over an account that outranks them.
 */
export function checkTargetRank(actorPerms: ReadonlySet<PermissionName>, targetPerms: Iterable<PermissionName>): ErrorCode | null {
  for (const p of targetPerms) if (!actorPerms.has(p)) return "forbidden";
  return null;
}

export function checkPasswordOp(target: { isLdap: boolean }): ErrorCode | null {
  return target.isLdap ? "ldap_password" : null;
}

/** Each id in turn: `check` → skipped with its code, else `apply` → done. */
export async function bulk<T extends string>(ids: T[], check: (id: T) => Promise<ErrorCode | null>, apply: (id: T) => Promise<void>): Promise<BulkResult> {
  const res: BulkResult = { done: [], skipped: [] };
  for (const id of ids) {
    const code = await check(id);
    if (code) res.skipped.push({ id, code });
    else {
      await apply(id);
      res.done.push(id);
    }
  }
  return res;
}
