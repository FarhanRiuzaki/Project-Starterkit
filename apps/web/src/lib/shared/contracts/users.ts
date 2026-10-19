import { z } from "zod";
import { USER_SORTS } from "../paging";
import { ListQuery, sortParam } from "./common";
import { Password } from "./auth";
import type { PermissionName } from "../permissions";

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

export const CreateUserBody = z.object({
  name: z.string().trim().min(1).max(100),
  username,
  email: z.string().trim().email().max(254),
  roles: z.array(z.string().min(1)).max(20).default([]),
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
  roles: z.array(z.string().min(1)).max(20).optional(),
});
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;

export const SetUserPasswordBody = z.object({ password: Password });
export type SetUserPasswordBody = z.infer<typeof SetUserPasswordBody>;

export const BulkUserBody = z.object({
  action: z.enum(["activate", "deactivate", "delete", "assignRole"]),
  ids: z.array(z.string().min(1)).min(1).max(100),
  role: z.string().min(1).max(64).optional(),
}).refine((b) => b.action !== "assignRole" || !!b.role, { message: "assignRole needs a role." });
export type BulkUserBody = z.infer<typeof BulkUserBody>;

/** One activity row on the user detail page: no before/after. */
export type ActivityBrief = { id: string; at: string; actor: { name: string }; action: string };

/**
 * GET /api/users/[id]: the user plus what the detail page shows (effective permissions, last 20 activity entries
 * targeting the user). Their sessions are a list of their own: GET /api/users/[id]/sessions.
 */
export type UserDetailDto = UserDto & { permissions: PermissionName[]; recentActivity: ActivityBrief[] | null };

export const SetUserStatusBody = z.object({ active: z.boolean() });
