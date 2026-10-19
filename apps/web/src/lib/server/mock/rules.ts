import type { BulkResult, ErrorCode } from "../../shared/contracts/common";
import type { PermissionName } from "../../shared/permissions";
import type { DbView, RoleRecord, UserRecord } from "./db";

export const SUPERADMIN = "Superadmin";

export type UserChange = { kind: "deactivate" | "delete" | "setRoles"; roles?: string[] };

export function effectivePermissions(user: UserRecord, roles: Map<string, RoleRecord>): Set<PermissionName> {
  const out = new Set<PermissionName>();
  for (const r of roles.values()) if (user.roles.includes(r.name)) for (const p of r.permissions) out.add(p);
  return out;
}

export function checkUserChange(actor: UserRecord, target: UserRecord, change: UserChange, db: DbView): ErrorCode | null {
  if (actor.id === target.id) return "self_action";
  const losesSuper =
    change.kind === "setRoles" ? !(change.roles ?? []).includes(SUPERADMIN) : true;
  if (target.isActive && target.roles.includes(SUPERADMIN) && losesSuper) {
    const others = [...db.users.values()].filter((u) => u.id !== target.id && u.isActive && u.roles.includes(SUPERADMIN));
    if (others.length === 0) return "last_superadmin";
  }
  return null;
}

export function checkRoleChange(role: RoleRecord, change: "edit" | "delete", db: DbView): ErrorCode | null {
  if (role.locked || role.name === SUPERADMIN) return "superadmin_locked";
  if (change === "delete" && [...db.users.values()].some((u) => u.roles.includes(role.name))) return "role_in_use";
  return null;
}

/** No privilege escalation: an actor may grant, remove or hand out only permissions they hold themselves. */
export function checkPermissionGrant(actorPerms: ReadonlySet<PermissionName>, changed: readonly PermissionName[]): ErrorCode | null {
  return changed.every((p) => actorPerms.has(p)) ? null : "forbidden";
}

/** An actor may add or remove a role only when they hold every permission it carries. */
export function checkRoleGrant(actorPerms: ReadonlySet<PermissionName>, role: RoleRecord): ErrorCode | null {
  return checkPermissionGrant(actorPerms, role.permissions);
}

export function checkPasswordOp(target: UserRecord): ErrorCode | null {
  return target.isLdap ? "ldap_password" : null;
}

export function bulk<T extends string>(ids: T[], check: (id: T) => ErrorCode | null, apply: (id: T) => void): BulkResult {
  const res: BulkResult = { done: [], skipped: [] };
  for (const id of ids) {
    const code = check(id);
    if (code) res.skipped.push({ id, code });
    else {
      apply(id);
      res.done.push(id);
    }
  }
  return res;
}
