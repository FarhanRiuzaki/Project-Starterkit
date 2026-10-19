import { z } from "zod";
import { Password } from "./auth";
import { UserDto } from "./users";
import { PERMISSIONS } from "../permissions";

export const MeDto = z.object({
  user: UserDto,
  permissions: z.array(z.enum(PERMISSIONS as [string, ...string[]])),
  csrf: z.string(),
});
export type MeDto = z.infer<typeof MeDto>;

export const SessionDto = z.object({
  id: z.string(),
  device: z.string(),
  ip: z.string(),
  lastSeenAt: z.string(),
  current: z.boolean(),
});
export type SessionDto = z.infer<typeof SessionDto>;

export const UpdateProfileBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

export const ChangePasswordBody = z.object({ currentPassword: z.string().min(1).max(256), password: Password });
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;

export const TwoFactorSetupDto = z.object({ secret: z.string(), otpauth: z.string() });
export type TwoFactorSetupDto = z.infer<typeof TwoFactorSetupDto>;

export const TwoFactorEnableBody = z.object({ code: z.string().trim().length(6) });
export type TwoFactorEnableBody = z.infer<typeof TwoFactorEnableBody>;

export const RecoveryCodesDto = z.object({ codes: z.array(z.string()) });
export type RecoveryCodesDto = z.infer<typeof RecoveryCodesDto>;
