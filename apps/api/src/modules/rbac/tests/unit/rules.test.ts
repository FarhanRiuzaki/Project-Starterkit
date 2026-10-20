// RBAC cases of the web mock's rules.test.ts (deleted in Task 9), on the shapes the API has (a role row, a holder count).
import { describe, expect, it } from "bun:test";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { checkPermissionGrant, checkRoleChange, checkRoleGrant, inCatalogOrder } from "../../rules";

const role = (name: string, permissions: PermissionName[], locked = false) => ({ name, locked, permissions });
const superRole = role("Superadmin", [...PERMISSIONS], true);
const viewerRole = role("Viewer", ["user.view", "role.view"]);

describe("rbac rules", () => {
  it("superadmin role cannot be edited or deleted", () => {
    expect(checkRoleChange(superRole, "edit", 0)).toBe("superadmin_locked");
    expect(checkRoleChange(superRole, "delete", 0)).toBe("superadmin_locked");
  });
  it("role with users cannot be deleted", () => {
    expect(checkRoleChange(viewerRole, "delete", 2)).toBe("role_in_use");
    expect(checkRoleChange(viewerRole, "edit", 2)).toBeNull();
    expect(checkRoleChange(role("Empty", []), "delete", 0)).toBeNull();
  });
  it("no escalation: an actor may grant, remove or carry only permissions they hold", () => {
    const actor = new Set<PermissionName>(["role.view", "role.edit", "user.view"]);
    expect(checkPermissionGrant(actor, ["user.view"])).toBeNull();
    expect(checkPermissionGrant(actor, [])).toBeNull();
    expect(checkPermissionGrant(actor, ["user.view", "user.delete"])).toBe("forbidden");
    expect(checkRoleGrant(actor, role("R", ["role.view"]))).toBeNull();
    expect(checkRoleGrant(actor, superRole)).toBe("forbidden");
  });
  it("inCatalogOrder dedupes and orders by the catalog", () => {
    expect(inCatalogOrder(["audit.view", "user.view", "audit.view", "role.view"])).toEqual(["user.view", "role.view", "audit.view"]);
  });
});
