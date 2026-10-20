// The user cases of apps/web/src/lib/server/mock/rules.test.ts. Not ported here: the effectivePermissions cases (that
// union is SQL now, auth/sessions.ts permsOf; covered by users.test.ts) and the role cases (rbac/rules.test.ts).
import { describe, expect, it, mock } from "bun:test";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { bulk, checkPasswordOp, checkTargetRank, checkUserChange } from "./rules";

const user = (id: string, roles: string[], over: { isActive?: boolean; isLdap?: boolean } = {}) => ({ id, roles, isActive: true, isLdap: false, ...over });
const me = user("me", ["Admin"]);
const onlySuper = user("sa", ["Superadmin"]);
const otherAdmin = user("oa", ["Admin"]);
const none = async () => 0;
const one = async () => 1;

const superPerms = new Set<PermissionName>(PERMISSIONS);
const adminPerms = new Set<PermissionName>(["user.view", "user.edit", "audit.view"]);
const viewerPerms = new Set<PermissionName>(["user.view", "role.view"]);

describe("rules", () => {
  it("cannot deactivate, delete, or change roles of self", async () => {
    for (const kind of ["deactivate", "delete", "setRoles"] as const) expect(await checkUserChange(me.id, me, { kind, roles: [] }, none)).toBe("self_action");
  });

  it("last active superadmin cannot lose the role or be deactivated", async () => {
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "deactivate" }, none)).toBe("last_superadmin");
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "delete" }, none)).toBe("last_superadmin");
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "setRoles", roles: ["Admin"] }, none)).toBe("last_superadmin");
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "setRoles", roles: ["Superadmin", "Admin"] }, none)).toBeNull();
  });

  it("a second active superadmin frees the first", async () => {
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "deactivate" }, one)).toBeNull();
    // an inactive one doesn't count: the SQL count (users/queries.ts otherSuperadmins) answers 0
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "deactivate" }, none)).toBe("last_superadmin");
    // the count is read only when it matters
    const count = mock(none);
    expect(await checkUserChange(otherAdmin.id, user("v", ["Viewer"]), { kind: "delete" }, count)).toBeNull();
    expect(await checkUserChange(otherAdmin.id, user("sa3", ["Superadmin"], { isActive: false }), { kind: "delete" }, count)).toBeNull();
    expect(count).not.toHaveBeenCalled();
  });

  it("password ops refused for LDAP users", () => {
    expect(checkPasswordOp(user("l", ["Viewer"], { isLdap: true }))).toBe("ldap_password");
    expect(checkPasswordOp(user("v", ["Viewer"]))).toBeNull();
  });

  it("bulk skips protected ids and applies the rest", async () => {
    const apply = mock(async () => {});
    expect(await bulk(["a", "self", "b"], async (id) => (id === "self" ? "self_action" : null), apply)).toEqual({
      done: ["a", "b"], skipped: [{ id: "self", code: "self_action" }],
    });
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("actor rank: an actor may act on a user only when they hold every permission that user has", () => {
    expect(checkTargetRank(adminPerms, superPerms)).toBe("forbidden"); // Admin on Superadmin
    expect(checkTargetRank(adminPerms, adminPerms)).toBeNull(); // same permissions
    expect(checkTargetRank(adminPerms, [])).toBeNull(); // no permissions at all
    expect(checkTargetRank(superPerms, adminPerms)).toBeNull();
    // Admin lacks role.view, which Viewer holds in this fixture: a partial overlap is still refused.
    expect(checkTargetRank(adminPerms, viewerPerms)).toBe("forbidden");
  });

  it("unknown role names: they grant nothing and don't count as Superadmin", async () => {
    // a name that only looks like Superadmin in another case is not the role
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "setRoles", roles: ["superadmin"] }, none)).toBe("last_superadmin");
    // setRoles without roles = no roles: the last Superadmin can't get it
    expect(await checkUserChange(otherAdmin.id, onlySuper, { kind: "setRoles" }, none)).toBe("last_superadmin");
  });
});
