import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import type { RoleRecord, UserRecord } from "./db";
import { bulk, checkPasswordOp, checkPermissionGrant, checkRoleChange, checkRoleGrant, checkTargetRank, checkUserChange, effectivePermissions } from "./rules";

const role = (name: string, permissions: PermissionName[], locked = false): RoleRecord => ({
  id: `r-${name}`, name, locked, permissions,
});
const user = (id: string, roles: string[], over: Partial<UserRecord> = {}): UserRecord => ({
  id, name: id, username: id, email: `${id}@x.test`, avatarUrl: null, isActive: true, isLdap: false,
  twoFactorEnabled: false, roles, connected: [], lastLoginAt: null, createdAt: "2026-01-01T00:00:00.000Z",
  passwordHash: null, totpSecret: null, recoveryCodes: [], ...over,
});

const superRole = role("Superadmin", [...PERMISSIONS], true);
const adminRole = role("Admin", ["user.view", "user.edit", "audit.view"]);
const viewerRole = role("Viewer", ["user.view", "role.view"]);
const me = user("me", ["Admin"]);
const onlySuper = user("sa", ["Superadmin"]);
const otherAdmin = user("oa", ["Admin"]);
const viewerUser = user("v", ["Viewer"]);
const roles = new Map([superRole, adminRole, viewerRole].map((r) => [r.id, r]));
const v = { users: new Map([me, onlySuper, otherAdmin, viewerUser].map((u) => [u.id, u])), roles };

describe("rules", () => {
  it("effective permissions are the union of all roles", () => {
    const set = effectivePermissions(user("x", ["Viewer", "Admin"]), roles);
    expect(set.has("user.edit")).toBe(true);
    expect(set.has("audit.view")).toBe(true);
    expect(set.has("role.view")).toBe(true);
    expect(set.has("role.delete")).toBe(false);
  });
  it("superadmin role cannot be edited or deleted", () => {
    expect(checkRoleChange(superRole, "edit", v)).toBe("superadmin_locked");
    expect(checkRoleChange(superRole, "delete", v)).toBe("superadmin_locked");
  });
  it("role with users cannot be deleted", () => {
    expect(checkRoleChange(viewerRole, "delete", v)).toBe("role_in_use");
    expect(checkRoleChange(viewerRole, "edit", v)).toBeNull();
    expect(checkRoleChange(role("Empty", []), "delete", v)).toBeNull();
  });
  it("cannot deactivate, delete, or change roles of self", () => {
    for (const kind of ["deactivate", "delete", "setRoles"] as const)
      expect(checkUserChange(me, me, { kind, roles: [] }, v)).toBe("self_action");
  });
  it("last active superadmin cannot lose the role or be deactivated", () => {
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "deactivate" }, v)).toBe("last_superadmin");
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "delete" }, v)).toBe("last_superadmin");
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "setRoles", roles: ["Admin"] }, v)).toBe("last_superadmin");
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "setRoles", roles: ["Superadmin", "Admin"] }, v)).toBeNull();
  });
  it("a second active superadmin frees the first", () => {
    const sa2 = user("sa2", ["Superadmin"]);
    const v2 = { ...v, users: new Map([...v.users, [sa2.id, sa2]]) };
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "deactivate" }, v2)).toBeNull();
    const inactive = user("sa3", ["Superadmin"], { isActive: false });
    const v3 = { ...v, users: new Map([...v.users, [inactive.id, inactive]]) };
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "deactivate" }, v3)).toBe("last_superadmin");
  });
  it("password ops refused for LDAP users", () => {
    expect(checkPasswordOp(user("l", ["Viewer"], { isLdap: true }))).toBe("ldap_password");
    expect(checkPasswordOp(viewerUser)).toBeNull();
  });
  it("bulk skips protected ids and applies the rest", () => {
    const apply = vi.fn();
    expect(bulk(["a", "self", "b"], (id) => (id === "self" ? "self_action" : null), apply)).toEqual({
      done: ["a", "b"], skipped: [{ id: "self", code: "self_action" }],
    });
    expect(apply).toHaveBeenCalledTimes(2);
  });
  it("no escalation: an actor may grant, remove or carry only permissions they hold", () => {
    const actor = new Set<PermissionName>(["role.view", "role.edit", "user.view"]);
    expect(checkPermissionGrant(actor, ["user.view"])).toBeNull();
    expect(checkPermissionGrant(actor, [])).toBeNull();
    expect(checkPermissionGrant(actor, ["user.view", "user.delete"])).toBe("forbidden");
    expect(checkRoleGrant(actor, role("R", ["role.view"]))).toBeNull();
    expect(checkRoleGrant(actor, superRole)).toBe("forbidden");
  });
  it("actor rank: an actor may act on a user only when they hold every permission that user has", () => {
    const perms = (u: UserRecord) => effectivePermissions(u, roles);
    expect(checkTargetRank(perms(me), perms(onlySuper))).toBe("forbidden"); // Admin on Superadmin
    expect(checkTargetRank(perms(me), perms(otherAdmin))).toBeNull(); // same permissions
    expect(checkTargetRank(perms(me), perms(user("x", [])))).toBeNull(); // no permissions at all
    expect(checkTargetRank(perms(onlySuper), perms(me))).toBeNull();
    // Admin lacks role.view, which Viewer holds in this fixture: a partial overlap is still refused.
    expect(checkTargetRank(perms(me), perms(viewerUser))).toBe("forbidden");
  });
  it("unknown role names: they grant nothing and don't count as Superadmin", () => {
    expect([...effectivePermissions(user("g", ["Ghost", "Viewer"]), roles)].sort()).toEqual(["role.view", "user.view"]);
    expect(effectivePermissions(user("g", ["Ghost"]), roles).size).toBe(0);
    // a name that only looks like Superadmin in another case is not the role
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "setRoles", roles: ["superadmin"] }, v)).toBe("last_superadmin");
    // setRoles without roles = no roles: the last Superadmin can't get it
    expect(checkUserChange(otherAdmin, onlySuper, { kind: "setRoles" }, v)).toBe("last_superadmin");
  });
});
