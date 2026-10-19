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

export const PERMISSIONS: readonly PermissionName[] = MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a}` as PermissionName),
);
