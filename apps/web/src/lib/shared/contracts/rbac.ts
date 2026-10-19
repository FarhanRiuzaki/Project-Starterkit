import { z } from "zod";
import { MODULES, PERMISSION_KEY, PERMISSIONS, type PermissionName } from "../permissions";

const PermissionEnum = z.enum(PERMISSIONS as [PermissionName, ...PermissionName[]]);

export const RoleDto = z.object({
  id: z.string(),
  name: z.string(),
  locked: z.boolean(),
  permissions: z.array(PermissionEnum),
  userCount: z.number().int(),
});
export type RoleDto = z.infer<typeof RoleDto>;

/** `name` is a catalog entry: every PermissionName, plus names added through POST /api/permissions (held by no role). */
export const PermissionDto = z.object({ name: z.string(), roles: z.array(z.string()) });
export type PermissionDto = z.infer<typeof PermissionDto>;

const roleName = z.string().trim().min(2).max(40);
const permissionList = z.array(PermissionEnum).max(PERMISSIONS.length);

export const CreateRoleBody = z.object({ name: roleName, permissions: permissionList.default([]) });
export type CreateRoleBody = z.infer<typeof CreateRoleBody>;

export const UpdateRoleBody = z.object({ name: roleName.optional(), permissions: permissionList.optional() });
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;

const MODULE_KEYS: readonly string[] = MODULES.map((m) => m.key);
/** `<module>.<action>` with the module from MODULES. */
export const PermissionKey = z.string().regex(PERMISSION_KEY).refine((n) => MODULE_KEYS.includes(n.split(".")[0]!));

export const CreatePermissionsBody = z.object({ names: z.array(PermissionKey).min(1).max(50) });
export type CreatePermissionsBody = z.infer<typeof CreatePermissionsBody>;

/** Names already in the catalog are skipped, not an error. */
export type CreatePermissionsResult = { created: string[]; skipped: string[] };
