// Public API of the auth module (sessions, passwords, TOTP, sign-in limits, the guard). Other modules import only this file.
export { authChallenges, loginBackoff, rateLimits, sessions, userTokens } from "./schema";
export { type Ctx, authenticate, bearer, guard } from "./guard";
export {
  Backoff, forgotLimits, type LoginLimits, loginGate, loginLimits, oauthStartLimits, passwordFails, RateLimiter, retryText,
} from "./limits";
export { hashPassword, verifyPassword } from "./password";
export {
  actorPermissions, type AuthUser, createSession, deviceOf, endSession, endUserSessions, permsOf, providersOf, resolveSession, rolesOf,
  sessionLive, toUserRow, type UserRow,
} from "./sessions";
export { matchTotpStep, newRecoveryCodes, newTotpSecret, otpauthUrl, totpCode, verifyTotp } from "./totp";
