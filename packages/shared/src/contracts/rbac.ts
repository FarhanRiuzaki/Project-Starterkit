import { z } from "zod";
import { PERMISSION_SORTS, ROLE_OPTION_SORTS, ROLE_SORTS } from "../paging";
import { MODULES, PERMISSION_KEY } from "../permissions";
import { ListQuery, sortParam } from "./common";


/** Most names the catalog may hold; a POST that would pass it is 400. */
export const CATALOG_MAX = 500;

export const RoleDto = z.object({
  id: z.string(),
  name: z.string(),
  locked: z.boolean(),
  /** Catalog names: the app's PermissionNames and any added through POST /api/permissions. */
  permissions: z.array(z.string()),
  userCount: z.number().int(),
});
export type RoleDto = z.infer<typeof RoleDto>;

/**
 * GET and PATCH /api/roles/{id}: the role plus the whole catalog (at most CATALOG_MAX names, the app's first, then
 * added ones in the order they were added), so its permission matrix has a cell for every name a role can hold.
 */
export const RoleDetailDto = RoleDto.extend({ catalog: z.array(z.string()).max(CATALOG_MAX) });
export type RoleDetailDto = z.infer<typeof RoleDetailDto>;

/** Most role names one PermissionDto lists; `roleCount` is the full number. */
export const PERMISSION_ROLES_SHOWN = 10;

/**
 * `name` is a catalog entry: every PermissionName, plus names added through POST /api/permissions (Superadmin holds them
 * from the start; any role can then be given them).
 * `id` = `name` (the row key every list shares). `roles` = the first PERMISSION_ROLES_SHOWN holders by name;
 * `roleCount` = how many roles hold it.
 */
export const PermissionDto = z.object({ id: z.string(), name: z.string(), roles: z.array(z.string()).max(PERMISSION_ROLES_SHOWN), roleCount: z.number().int().min(0) });
export type PermissionDto = z.infer<typeof PermissionDto>;

/** GET /api/roles: `q` matches the role name. */
export const RoleListQuery = ListQuery.extend({ sort: sortParam(ROLE_SORTS) });
export type RoleListQuery = z.infer<typeof RoleListQuery>;

/** GET /api/users/roles: role options for pickers (user.view); `q` matches the name. */
export const RoleOptionQuery = ListQuery.extend({ sort: sortParam(ROLE_OPTION_SORTS) });
export type RoleOptionQuery = z.infer<typeof RoleOptionQuery>;
export const RoleOption = z.object({ id: z.string(), name: z.string() });
export type RoleOption = z.infer<typeof RoleOption>;

const MODULE_KEYS = MODULES.map((m) => m.key) as [string, ...string[]];
/** GET /api/permissions: `q` matches the name; `module` is exact. */
export const PermissionListQuery = ListQuery.extend({ sort: sortParam(PERMISSION_SORTS), module: z.enum(MODULE_KEYS).optional() });
export type PermissionListQuery = z.infer<typeof PermissionListQuery>;


const roleName = z.string().trim().min(2).max(40);
/** `<module>.<action>` with the module from MODULES. */
export const PermissionKey = z.string().regex(PERMISSION_KEY).refine((n) => MODULE_KEYS.includes(n.split(".")[0]!));
/** Catalog names (checked against the catalog in the transaction: an unknown one is 400). */
const permissionList = z.array(PermissionKey).max(CATALOG_MAX);

export const CreateRoleBody = z.object({ name: roleName, permissions: permissionList.default([]) });
export type CreateRoleBody = z.infer<typeof CreateRoleBody>;

/**
 * `add` and `remove` apply to the role's current set on the server, so a page loaded before someone else's change
 * can't undo it by sending a whole stale set. The same permission can't be in both.
 */
export const UpdateRoleBody = z.strictObject({ name: roleName.optional(), add: permissionList.optional(), remove: permissionList.optional() })
  .refine((b) => !b.add?.some((p) => b.remove?.includes(p)), { message: "A permission can't be both added and removed." });
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;

export const CreatePermissionsBody = z.object({ names: z.array(PermissionKey).min(1).max(50) });
export type CreatePermissionsBody = z.infer<typeof CreatePermissionsBody>;


/** Names already in the catalog are skipped, not an error. */
export const CreatePermissionsResult = z.object({ created: z.array(z.string()), skipped: z.array(z.string()) });
export type CreatePermissionsResult = z.infer<typeof CreatePermissionsResult>;
