import { z } from "zod";
import { ListQuery } from "./common";
import { Password } from "./auth";

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

export const UserListQuery = ListQuery.extend({
  role: z.string().max(64).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type UserListQuery = z.infer<typeof UserListQuery>;

const username = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/);

export const CreateUserBody = z.object({
  name: z.string().trim().min(1).max(100),
  username,
  email: z.string().trim().email().max(254),
  password: Password,
  roles: z.array(z.string().min(1)).max(20).default([]),
  isActive: z.boolean().default(true),
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
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(["activate", "deactivate", "delete"]),
});
export type BulkUserBody = z.infer<typeof BulkUserBody>;
