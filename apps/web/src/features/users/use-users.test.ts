import { describe, expect, it } from "vitest";
import { PERMISSIONS, type PermissionName } from "@/lib/shared/permissions";
import { protection, rankBlock, skipReason } from "./use-users";

const ADMIN = new Set<PermissionName>(PERMISSIONS.filter((p) => !p.startsWith("role.") && !p.startsWith("permission.")));
const row = (id: string, permissions: readonly PermissionName[]) => ({
  id, name: id, username: id, email: `${id}@x.test`, avatarUrl: null, isActive: true, isLdap: false, twoFactorEnabled: false,
  roles: [], connected: [], lastLoginAt: null, createdAt: "2026-01-01T00:00:00.000Z", permissions: [...permissions],
});

describe("users: client mirror of the server's protection rules", () => {
  it("rankBlock: a user holding a permission the viewer lacks is blocked, an equal or lower one is not", () => {
    expect(rankBlock(row("sa", PERMISSIONS), ADMIN)).toMatch(/permissions your role doesn't hold/);
    expect(rankBlock(row("a2", [...ADMIN]), ADMIN)).toBeNull();
    expect(rankBlock(row("v", ["user.view"]), ADMIN)).toBeNull();
  });

  it("protection: self first, then rank, then the last Superadmin", () => {
    expect(protection(row("me", [...ADMIN]), "me", ADMIN, null)).toMatch(/your own account/);
    expect(protection(row("sa", PERMISSIONS), "me", ADMIN, "sa")).toMatch(/permissions your role doesn't hold/);
    expect(protection(row("sa", PERMISSIONS), "me", new Set(PERMISSIONS), "sa")).toMatch(/last active Superadmin/);
    expect(protection(row("v", ["user.view"]), "me", ADMIN, "sa")).toBeNull();
  });

  it("skipReason: every code the bulk route skips with has words; an unknown code never shows raw", () => {
    for (const c of ["self_action", "last_superadmin", "not_found", "forbidden", "bad_request"]) expect(skipReason(c)).not.toMatch(/_|^couldn't/);
    expect(skipReason("weird_code")).toBe("couldn't be changed");
  });
});
