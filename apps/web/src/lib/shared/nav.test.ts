import { describe, expect, it } from "vitest";
import { crumbs, isActive, NAV, navFor } from "./nav";
import { PERMISSIONS } from "./permissions";

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
    expect(crumbs("/audit/activity").map((c) => c.label)).toEqual(["Activity log"]);
    expect(crumbs("/ds").map((c) => c.label)).toEqual(["Design system"]);
    expect(crumbs("/nope")).toEqual([]);
  });
});
