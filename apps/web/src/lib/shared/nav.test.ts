import { describe, expect, it } from "vitest";
import { activeChild, crumbs, isActive, isSubPage, NAV, navFor, pagePerm, type NavItem } from "./nav";
import { DEFAULT_PREFS, viewHref } from "./prefs";
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

  it("all permissions: every item, the brief's eight keeping their order (a new module's item goes anywhere between)", () => {
    const BRIEF = ["Dashboard", "Users", "Roles", "Permissions", "Activity log", "Sign-in log", "Design system", "Profile"];
    const all = NAV.map((n) => n.label);
    expect(all.filter((l) => BRIEF.includes(l))).toEqual(BRIEF);
    expect([all[0], ...all.slice(-2)]).toEqual(["Dashboard", "Design system", "Profile"]);
    expect(labels(new Set(PERMISSIONS))).toEqual(all);
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
  it("breadcrumb: the nav page the path belongs to, then nothing for unknown; a sub-page is one below its nav page", () => {
    const all = new Set(PERMISSIONS);
    expect(crumbs("/audit/activity", all).map((c) => [c.label, c.href])).toEqual([["Activity log", "/audit/activity"]]);
    expect(crumbs("/users/u-1", all).map((c) => c.label)).toEqual(["Users"]);
    expect(crumbs("/nope", all)).toEqual([]);
    expect([isSubPage("/users"), isSubPage("/users/u-1"), isSubPage("/me/security"), isSubPage("/"), isSubPage("/nope")]).toEqual([false, true, true, false, false]);
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

describe("nav children", () => {
  const users = NAV.find((n) => n.href === "/users")!;
  it("Users has one navigation entry; its status views remain URL filters and the remembered view is preserved", () => {
    expect(users.children).toBeUndefined();
    expect(users.shortcut).toBe("G U");
    expect(navFor(new Set(PERMISSIONS)).flatMap(s => s.items).filter(n => n.href === "/users")).toHaveLength(1);
    const query = "pageSize=25&role=Viewer&status=active&status=inactive";
    expect(viewHref(users.href, { ...DEFAULT_PREFS, views: { "/users": query } })).toBe(`/users?${query}`);
  });
  it("activeChild remains available for another module with named child views", () => {
    const item: NavItem = { ...users, children: [
      { href: "/users", label: "All", icon: "users" },
      { href: "/users?status=inactive", label: "Inactive", icon: "users" },
    ] };
    expect(activeChild(item, "/users", new URLSearchParams(""))?.label).toBe("All");
    expect(activeChild(item, "/users", new URLSearchParams("status=inactive&sort=-createdAt&page=2"))?.label).toBe("Inactive");
    expect(activeChild(item, "/users", new URLSearchParams("role=Admin"))?.label).toBe("All");
    expect(activeChild(item, "/users/u-1", new URLSearchParams(""))).toBeNull();
  });
});
