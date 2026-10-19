import type { PermissionName } from "./permissions";

export type NavIcon = "dashboard" | "users" | "roles" | "permissions" | "activity" | "signin" | "ds" | "profile";
export type NavGroup = "main" | "access" | "audit" | "personal";
/** `shortcut` is "" for an item without one; `perm` null = every signed-in user. */
export type NavItem = { href: string; label: string; icon: NavIcon; shortcut: string; group: NavGroup; perm: PermissionName | null };
export type NavSection = { id: NavGroup; label: string; items: NavItem[] };

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", shortcut: "G D", group: "main", perm: null },
  { href: "/users", label: "Users", icon: "users", shortcut: "G U", group: "access", perm: "user.view" },
  { href: "/roles", label: "Roles", icon: "roles", shortcut: "G R", group: "access", perm: "role.view" },
  { href: "/permissions", label: "Permissions", icon: "permissions", shortcut: "G P", group: "access", perm: "permission.view" },
  { href: "/audit/activity", label: "Activity log", icon: "activity", shortcut: "G A", group: "audit", perm: "audit.view" },
  { href: "/audit/auth", label: "Sign-in log", icon: "signin", shortcut: "G S", group: "audit", perm: "audit.view" },
  { href: "/ds", label: "Design system", icon: "ds", shortcut: "", group: "personal", perm: null },
  { href: "/me", label: "Profile", icon: "profile", shortcut: "G M", group: "personal", perm: null },
];

const GROUPS: { id: NavGroup; label: string }[] = [
  { id: "main", label: "Main" }, { id: "access", label: "Access" }, { id: "audit", label: "Audit" }, { id: "personal", label: "Personal" },
];

/** Sidebar sections for these permissions: items the user cannot open are left out, then empty groups. */
export function navFor(perms: ReadonlySet<PermissionName>): NavSection[] {
  return GROUPS
    .map((g) => ({ ...g, items: NAV.filter((n) => n.group === g.id && (n.perm === null || perms.has(n.perm))) }))
    .filter((s) => s.items.length > 0);
}

/** `exact`: active only on its own path. "/" is always exact. */
export function isActive(pathname: string, href: string, exact = false): boolean {
  const p = pathname.split(/[?#]/)[0] ?? "/";
  return href === "/" || exact ? p === href : p === href || p.startsWith(`${href}/`);
}

export type Crumb = { label: string; href?: string; icon?: NavIcon };

const clean = (pathname: string) => (pathname.split(/[?#]/)[0] ?? "/").replace(/\/+$/, "") || "/";
/** The nav page a path belongs to (longest href wins, so /audit/auth is not /audit). */
const navItemOf = (p: string) => [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(p, n.href));

/**
 * Top bar breadcrumb: the nav page the path belongs to, only when the viewer may open it, so a page the role can't
 * open ("Page not found") doesn't name itself in the breadcrumb.
 */
export function crumbs(pathname: string, perms: ReadonlySet<PermissionName>): Crumb[] {
  const top = navItemOf(clean(pathname));
  return top && (top.perm === null || perms.has(top.perm)) ? [{ label: top.label, href: top.href, icon: top.icon }] : [];
}

/**
 * The permission a signed-in page needs, by path: its nav page's, with the finer rules of sub-pages (/users/new needs
 * user.create, /users/<id>/edit user.edit). The (main) layout answers a real 404 with it before streaming starts;
 * each page.tsx guards with the same (architecture.test.ts compares them), which covers client navigations.
 */
export function pagePerm(pathname: string): PermissionName | null {
  const p = clean(pathname);
  if (p === "/users/new") return "user.create";
  if (/^\/users\/[^/]+\/edit$/.test(p)) return "user.edit";
  return navItemOf(p)?.perm ?? null;
}
