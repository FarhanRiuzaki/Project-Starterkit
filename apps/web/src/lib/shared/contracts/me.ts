import { z } from "zod";
import { SESSION_SORTS } from "../paging";
import { Password } from "./auth";
import { ListQuery, sortParam } from "./common";

export const SessionDto = z.object({
  id: z.string(),
  device: z.string(),
  ip: z.string(),
  lastSeenAt: z.string(),
  current: z.boolean(),
});
export type SessionDto = z.infer<typeof SessionDto>;

/** GET /api/me/sessions and GET /api/users/[id]/sessions: one user's sessions, paged (no `q`). */
export const SessionListQuery = ListQuery.omit({ q: true }).extend({ sort: sortParam(SESSION_SORTS) });
export type SessionListQuery = z.infer<typeof SessionListQuery>;

export const UpdateProfileBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

export const ChangePasswordBody = z.object({ current: z.string().min(1).max(256), next: Password });
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;

export const TwoFactorSetupDto = z.object({ secret: z.string(), otpauthUrl: z.string() });
export type TwoFactorSetupDto = z.infer<typeof TwoFactorSetupDto>;

export const TwoFactorEnableBody = z.object({ code: z.string().trim().length(6) });
export type TwoFactorEnableBody = z.infer<typeof TwoFactorEnableBody>;

export const RecoveryCodesDto = z.object({ recoveryCodes: z.array(z.string()) });
export type RecoveryCodesDto = z.infer<typeof RecoveryCodesDto>;

export const DisableTwoFactorBody = z.object({ password: z.string().min(1).max(256) });
export type DisableTwoFactorBody = z.infer<typeof DisableTwoFactorBody>;

export const ConnectionProvider = z.enum(["google", "apple"]);
export type ConnectionProvider = z.infer<typeof ConnectionProvider>;
