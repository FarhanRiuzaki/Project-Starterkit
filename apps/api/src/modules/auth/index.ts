// Public API of the auth module (sign-in routes, sessions, passwords, TOTP, the guard): what other modules and the
// test harness use. Other modules import only this file.
export { authController } from "./controller";
export { sessions, userTokens } from "./schema";
export { type Ctx, authenticate, bearer, guard } from "./guard";
export { oauthStartLimits, retryText } from "./limits";
export { hashPassword, verifyPassword } from "./password";
export { oauthOnly } from "./rules";
export { completeSignIn, deleteUserTokens, logAuth, reauth, userById } from "./service";
export {
  actorPermissions, type AuthUser, createSession, endSession, endUserSessions, isLiveSession, lockLiveSession, permsOf, resolveSession, rolesOf,
  sessionLive, sessionPage, toUserRow, type UserRow,
} from "./sessions";
export { matchTotpStep, newRecoveryCodes, newTotpSecret, otpauthUrl, totpCode } from "./totp";
