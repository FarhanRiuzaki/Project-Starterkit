import { z } from "zod";
import { USER_SORTS } from "../paging";
import { ListQuery, sortParam } from "./common";
import { Password } from "./auth";
import { PERMISSIONS, type PermissionName } from "../permissions";

export const UserDto = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  isActive: z.boolean(),
  isLdap: z.boolean(),
  twoFactorEnabled: z.boolean(),
  roles: z.array(z.string()),
  connected: z.array(z.enum(["google", "apple"])),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof UserDto>;

export { USER_SORTS };

export const UserListQuery = ListQuery.extend({
  sort: sortParam(USER_SORTS),
  role: z.string().max(64).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type UserListQuery = z.infer<typeof UserListQuery>;

const username = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/);
/** Most roles one user holds. */
export const MAX_USER_ROLES = 20;

export const CreateUserBody = z.object({
  name: z.string().trim().min(1).max(100),
  username,
  email: z.string().trim().email().max(254),
  roles: z.array(z.string().min(1)).max(MAX_USER_ROLES).default([]),
  isActive: z.boolean().default(true),
  isLdap: z.boolean().default(false),
  password: Password.optional(),
  invite: z.boolean().optional(),
}).refine((b) => (b.isLdap ? b.password === undefined && !b.invite : (b.password !== undefined) !== !!b.invite), {
  message: "A directory user has no password or invite; any other user needs exactly one of them.",
});
export type CreateUserBody = z.infer<typeof CreateUserBody>;

export const UpdateUserBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  username: username.optional(),
  email: z.string().trim().email().max(254).optional(),
  isActive: z.boolean().optional(),
  roles: z.array(z.string().min(1)).max(MAX_USER_ROLES).optional(),
});
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;

export const BulkUserBody = z.object({
  action: z.enum(["activate", "deactivate", "delete", "assignRole"]),
  ids: z.array(z.string().min(1)).min(1).max(100),
  role: z.string().min(1).max(64).optional(),
}).refine((b) => b.action !== "assignRole" || !!b.role, { message: "assignRole needs a role." });
export type BulkUserBody = z.infer<typeof BulkUserBody>;

/** One activity row on the user detail page: no before/after. */
export const ActivityBrief = z.object({ id: z.string(), at: z.string(), actor: z.object({ name: z.string() }), action: z.string() });
export type ActivityBrief = z.infer<typeof ActivityBrief>;

/**
 * A row of GET /api/users: the user plus their effective permissions (the union of their roles), so a screen can
 * block actions on a user who holds a permission the viewer lacks (actor rank) before the server refuses them.
 */
export const UserRowDto = UserDto.extend({ permissions: z.array(z.enum(PERMISSIONS as [PermissionName, ...PermissionName[]])) });
export type UserRowDto = z.infer<typeof UserRowDto>;

/**
 * GET /api/users/[id]: the row plus the last 20 activity entries targeting the user (null without audit.view). Their
 * sessions are a list of their own: GET /api/users/[id]/sessions.
 */
export const UserDetailDto = UserRowDto.extend({ recentActivity: z.array(ActivityBrief).nullable() });
export type UserDetailDto = z.infer<typeof UserDetailDto>;

export const SetUserStatusBody = z.object({ active: z.boolean() });
