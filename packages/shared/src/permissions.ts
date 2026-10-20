export type Action = "view" | "create" | "edit" | "delete";

export const MODULES: { key: "user" | "role" | "permission" | "audit"; actions: Action[] }[] = [
  { key: "user", actions: ["view", "create", "edit", "delete"] },
  { key: "role", actions: ["view", "create", "edit", "delete"] },
  { key: "permission", actions: ["view", "create"] },
  { key: "audit", actions: ["view"] },
];

export type PermissionName =
  | "user.view" | "user.create" | "user.edit" | "user.delete"
  | "role.view" | "role.create" | "role.edit" | "role.delete"
  | "permission.view" | "permission.create"
  | "audit.view";

/** A permission name: `<module>.<action>`, an action of lowercase letters, digits or underscores (the module is checked against MODULES separately). */
export const PERMISSION_KEY = /^[a-z]+\.[a-z][a-z0-9_]{0,31}$/;

/** UI label of a module key or an action: "user" → "User", "view" → "View". */
export const permissionLabel = (part: string): string => part.charAt(0).toUpperCase() + part.slice(1);

export const PERMISSIONS: readonly PermissionName[] = MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a}` as PermissionName),
);

/**
 * `perms` plus the module's `view` for any other action of that module (`user.edit` → `user.view`): a screen that
 * edits a list must be able to open it. Role saves (server and matrix) apply it, so a role never holds one without view.
 */
export function withViews<P extends string>(perms: Iterable<P>): Set<P> {
  const out = new Set(perms);
  for (const p of out) {
    const view = `${p.split(".")[0]}.view` as P & PermissionName;
    if (PERMISSIONS.includes(view)) out.add(view);
  }
  return out;
}
