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

/** Top bar breadcrumb: the nav page the path belongs to (longest href wins, so /audit/auth is not /audit). */
export function crumbs(pathname: string): Crumb[] {
  const p = (pathname.split(/[?#]/)[0] ?? "/").replace(/\/+$/, "") || "/";
  const top = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(p, n.href));
  return top ? [{ label: top.label, href: top.href, icon: top.icon }] : [];
}
