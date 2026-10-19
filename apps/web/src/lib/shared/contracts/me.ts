import { z } from "zod";
import { SESSION_SORTS } from "../paging";
import { Password } from "./auth";
import { ListQuery, sortParam } from "./common";
import { UserDto } from "./users";

/**
 * GET /api/me (and the answers of PATCH /api/me and /api/me/connections): the user plus `hasPassword`. An account with
 * no password that isn't a directory user signs in only through a connected Google or Apple account: its email comes
 * from the provider, and it has no second factor to turn on.
 */
export const MeDto = UserDto.extend({ hasPassword: z.boolean() });
export type MeDto = z.infer<typeof MeDto>;

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

/** `currentPassword` (the directory password for LDAP users) is required when `email` changes. */
export const UpdateProfileBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  currentPassword: z.string().min(1).max(256).optional(),
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

/**
 * Exactly one proof: `password` (the account password, or the directory password for LDAP users), or `recoveryCode`
 * for an account that signs in only through Google or Apple (it has no password; the code is spent).
 */
export const DisableTwoFactorBody = z.object({
  password: z.string().min(1).max(256).optional(),
  recoveryCode: z.string().trim().min(6).max(32).optional(),
}).refine((b) => (b.password === undefined) !== (b.recoveryCode === undefined), { message: "Send a password or a recovery code." });
export type DisableTwoFactorBody = z.infer<typeof DisableTwoFactorBody>;

export const ConnectionProvider = z.enum(["google", "apple"]);
export type ConnectionProvider = z.infer<typeof ConnectionProvider>;
