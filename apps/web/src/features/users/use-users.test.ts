import { describe, expect, it } from "vitest";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { ApiError } from "@/lib/client/api";
import { protection, rankBlock, skipReason, userGone } from "./use-users";

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

  it("userGone: sessions stay off once the detail answered 404 or this page deleted the user; other errors keep them on", () => {
    expect(userGone(new ApiError(404, "not_found", "x"), false)).toBe(true);
    expect(userGone(null, true)).toBe(true);
    expect(userGone(new ApiError(500, "internal", "x"), false)).toBe(false);
    expect(userGone(null, false)).toBe(false);
  });
});

describe("patchUserCache (optimistic status)", () => {
  it("patches the user in every cached list page and the detail, and the returned function puts them back", async () => {
    const { QueryClient } = await import("@tanstack/react-query");
    const { patchUserCache } = await import("./use-users");
    const qc = new QueryClient();
    const list = { items: [row("a", []), row("b", [])], total: 2, page: 1, pageSize: 15 };
    qc.setQueryData(["users", "/api/users"], list);
    qc.setQueryData(["users", "detail", "b"], row("b", []));
    qc.setQueryData(["users", "/api/users/b/sessions"], { items: [{ id: "s1" }], total: 1, page: 1, pageSize: 15 });
    const restore = await patchUserCache(qc, "b", { isActive: false });
    expect(qc.getQueryData<typeof list>(["users", "/api/users"])!.items.map((u) => u.isActive)).toEqual([true, false]);
    expect(qc.getQueryData<{ isActive: boolean }>(["users", "detail", "b"])!.isActive).toBe(false);
    expect(qc.getQueryData(["users", "/api/users/b/sessions"])).toEqual({ items: [{ id: "s1" }], total: 1, page: 1, pageSize: 15 });
    restore();
    expect(qc.getQueryData(["users", "/api/users"])).toEqual(list);
    expect(qc.getQueryData<{ isActive: boolean }>(["users", "detail", "b"])!.isActive).toBe(true);
  });
});
