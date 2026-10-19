import { z } from "zod";

export type AuthMethod = "password" | "ldap" | "google" | "apple";

export const LoginBody = z.object({
  login: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
  method: z.enum(["password", "ldap"]).default("password"),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const LoginResult = z.object({ twoFactorRequired: z.boolean() });
export type LoginResult = z.infer<typeof LoginResult>;

/** `code` is a 6-digit one-time code or a recovery code. */
export const TwoFactorBody = z.object({ code: z.string().trim().min(6).max(32) });
export type TwoFactorBody = z.infer<typeof TwoFactorBody>;

export const ForgotPasswordBody = z.object({ email: z.string().email().max(254) });
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBody>;

export const Password = z.string().min(8).max(128);

export const ResetPasswordBody = z.object({ token: z.string().min(1).max(256), password: Password });
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>;
