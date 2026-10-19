import { z } from "zod";
import { PERMISSIONS, type PermissionName } from "../permissions";

const PermissionEnum = z.enum(PERMISSIONS as [PermissionName, ...PermissionName[]]);

export const RoleDto = z.object({
  id: z.string(),
  name: z.string(),
  locked: z.boolean(),
  permissions: z.array(PermissionEnum),
  userCount: z.number().int(),
});
export type RoleDto = z.infer<typeof RoleDto>;

export const PermissionDto = z.object({ name: PermissionEnum, roles: z.array(z.string()) });
export type PermissionDto = z.infer<typeof PermissionDto>;

const roleName = z.string().trim().min(2).max(40);

export const CreateRoleBody = z.object({ name: roleName, permissions: z.array(PermissionEnum).max(PERMISSIONS.length) });
export type CreateRoleBody = z.infer<typeof CreateRoleBody>;

export const UpdateRoleBody = z.object({
  name: roleName.optional(),
  permissions: z.array(PermissionEnum).max(PERMISSIONS.length).optional(),
});
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;

/** Replace the permission set of every role in one call (matrix save). */
export const SetMatrixBody = z.object({ roles: z.record(z.string(), z.array(PermissionEnum)) });
export type SetMatrixBody = z.infer<typeof SetMatrixBody>;
