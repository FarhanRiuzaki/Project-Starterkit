import { describe, expect, it } from "vitest";
import { crumbs, isActive, NAV, navFor, pagePerm } from "./nav";
import { PERMISSIONS } from "@starterkit/shared/permissions";

const labels = (perms: Parameters<typeof navFor>[0]) => navFor(perms).flatMap((s) => s.items.map((i) => i.label));

describe("navFor", () => {
  it("user.view sees Dashboard, Users, Design system, Profile only", () => {
    expect(labels(new Set(["user.view"]))).toEqual(["Dashboard", "Users", "Design system", "Profile"]);
  });

  it("no permissions: items without a permission only; empty groups disappear", () => {
    const sections = navFor(new Set());
    expect(sections.map((s) => s.id)).toEqual(["main", "personal"]);
    expect(labels(new Set())).toEqual(["Dashboard", "Design system", "Profile"]);
  });

  it("all permissions: the 8 items in brief order", () => {
    expect(NAV.map((n) => n.label)).toEqual(["Dashboard", "Users", "Roles", "Permissions", "Activity log", "Sign-in log", "Design system", "Profile"]);
    expect(labels(new Set(PERMISSIONS))).toEqual(
      ["Dashboard", "Users", "Roles", "Permissions", "Activity log", "Sign-in log", "Design system", "Profile"]);
  });

  it("shortcuts are unique", () => {
    const keys = NAV.map((n) => n.shortcut).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isActive / crumbs", () => {
  it("/ is active only on /; others match sub-paths", () => {
    expect(isActive("/users/u-1", "/")).toBe(false);
    expect(isActive("/users/u-1", "/users")).toBe(true);
    expect(isActive("/usersx", "/users")).toBe(false);
  });
  it("breadcrumb: nav page, then nothing for unknown", () => {
    const all = new Set(PERMISSIONS);
    expect(crumbs("/audit/activity", all).map((c) => c.label)).toEqual(["Activity log"]);
    expect(crumbs("/ds", all).map((c) => c.label)).toEqual(["Design system"]);
    expect(crumbs("/nope", all)).toEqual([]);
  });
  it("breadcrumb: a page the viewer can't open doesn't name itself", () => {
    expect(crumbs("/roles", new Set(["user.view"]))).toEqual([]);
    expect(crumbs("/roles/role-admin", new Set(["user.view"]))).toEqual([]);
    expect(crumbs("/users/u-1", new Set(["user.view"])).map((c) => c.label)).toEqual(["Users"]);
  });
});

describe("pagePerm", () => {
  it("is the nav page's permission, with the finer rules for creating and editing users", () => {
    expect(pagePerm("/")).toBeNull();
    expect(pagePerm("/me/security")).toBeNull();
    expect(pagePerm("/users?page=2")).toBe("user.view");
    expect(pagePerm("/users/u-1")).toBe("user.view");
    expect(pagePerm("/users/new")).toBe("user.create");
    expect(pagePerm("/users/u-1/edit/")).toBe("user.edit");
    expect(pagePerm("/roles/role-admin")).toBe("role.view");
    expect(pagePerm("/permissions")).toBe("permission.view");
    expect(pagePerm("/audit/auth")).toBe("audit.view");
    expect(pagePerm("/nope")).toBeNull();
  });
});
