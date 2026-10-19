import { z } from "zod";
import { PERMISSION_SORTS, ROLE_OPTION_SORTS, ROLE_SORTS } from "../paging";
import { MODULES, PERMISSION_KEY, PERMISSIONS, type PermissionName } from "../permissions";
import { ListQuery, sortParam } from "./common";

const PermissionEnum = z.enum(PERMISSIONS as [PermissionName, ...PermissionName[]]);

export const RoleDto = z.object({
  id: z.string(),
  name: z.string(),
  locked: z.boolean(),
  permissions: z.array(PermissionEnum),
  userCount: z.number().int(),
});
export type RoleDto = z.infer<typeof RoleDto>;

/**
 * `name` is a catalog entry: every PermissionName, plus names added through POST /api/permissions (held by no role).
 * `id` = `name` (the row key every list shares).
 */
export const PermissionDto = z.object({ id: z.string(), name: z.string(), roles: z.array(z.string()) });
export type PermissionDto = z.infer<typeof PermissionDto>;

/** GET /api/roles: `q` matches the role name. */
export const RoleListQuery = ListQuery.extend({ sort: sortParam(ROLE_SORTS) });
export type RoleListQuery = z.infer<typeof RoleListQuery>;

/** GET /api/users/roles: role options for pickers (user.view); `q` matches the name. */
export const RoleOptionQuery = ListQuery.extend({ sort: sortParam(ROLE_OPTION_SORTS) });
export type RoleOptionQuery = z.infer<typeof RoleOptionQuery>;
export type RoleOption = { id: string; name: string };

const MODULE_KEYS = MODULES.map((m) => m.key) as [string, ...string[]];
/** GET /api/permissions: `q` matches the name; `module` is exact. */
export const PermissionListQuery = ListQuery.extend({ sort: sortParam(PERMISSION_SORTS), module: z.enum(MODULE_KEYS).optional() });
export type PermissionListQuery = z.infer<typeof PermissionListQuery>;

const roleName = z.string().trim().min(2).max(40);
const permissionList = z.array(PermissionEnum).max(PERMISSIONS.length);

export const CreateRoleBody = z.object({ name: roleName, permissions: permissionList.default([]) });
export type CreateRoleBody = z.infer<typeof CreateRoleBody>;

/**
 * `add` and `remove` apply to the role's current set on the server, so a page loaded before someone else's change
 * can't undo it by sending a whole stale set. The same permission can't be in both.
 */
export const UpdateRoleBody = z.strictObject({ name: roleName.optional(), add: permissionList.optional(), remove: permissionList.optional() })
  .refine((b) => !b.add?.some((p) => b.remove?.includes(p)), { message: "A permission can't be both added and removed." });
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;

/** `<module>.<action>` with the module from MODULES. */
export const PermissionKey = z.string().regex(PERMISSION_KEY).refine((n) => MODULE_KEYS.includes(n.split(".")[0]!));

export const CreatePermissionsBody = z.object({ names: z.array(PermissionKey).min(1).max(50) });
export type CreatePermissionsBody = z.infer<typeof CreatePermissionsBody>;

/** Most names the catalog may hold; a POST that would pass it is 400. */
export const CATALOG_MAX = 500;

/** Names already in the catalog are skipped, not an error. */
export type CreatePermissionsResult = { created: string[]; skipped: string[] };
