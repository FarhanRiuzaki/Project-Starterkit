import { z } from "zod";
import { Password } from "./password";
import { UserDto } from "./users";

export type AuthMethod = "password" | "ldap" | "google" | "apple";

export const LoginBody = z.object({
  login: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
  method: z.enum(["password", "ldap"]).default("password"),
  /** Deep link to return to; the server keeps it only when internal (afterSignIn). */
  next: z.string().max(2048).optional(),
});
export type LoginBody = z.infer<typeof LoginBody>;

/** Where the browser goes next: `/login/2fa[?next=…]` when a second factor is due, else the signed-in landing page. */
export const LoginResult = z.object({ next: z.string() });
export type LoginResult = z.infer<typeof LoginResult>;

/** `code` is a 6-digit one-time code or a recovery code. */
export const TwoFactorBody = z.object({ code: z.string().trim().min(6).max(32), next: z.string().max(2048).optional() });
export type TwoFactorBody = z.infer<typeof TwoFactorBody>;

export const ForgotPasswordBody = z.object({ email: z.string().email().max(254) });
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBody>;

export { Password };

export const ResetPasswordBody = z.object({ token: z.string().min(1).max(256), password: Password });
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>;

/** GET /v1/auth/context (API-internal, for the web's page guards): the signed-in user and their permissions in catalog order. */
/** `permissions`: every catalog name the user holds (the app's in catalog order, then added ones A–Z). */
export const AuthContextDto = z.object({ user: UserDto, permissions: z.array(z.string()) });
export type AuthContextDto = z.infer<typeof AuthContextDto>;
