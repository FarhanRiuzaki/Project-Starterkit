// The signed-in user's own account: profile, password, 2FA, connected providers, sessions. Connecting Google or Apple
// is the oauth module's link mode. Nothing here lowers the number of active Superadmins (no role, status or delete
// change), so the Superadmin lock isn't taken. Checks that read the user lock its row in the transaction and re-read
// what they decide on. Owns no table: users, auth and oauth make the writes through their public API.
import { BRAND } from "@starterkit/shared/brand";
import type {
  ChangePasswordBody, ConnectionProvider, DisableTwoFactorBody, MeDto as MeDtoType, ReauthBody, TwoFactorEnableBody, UpdateProfileBody,
} from "@starterkit/shared/contracts/me";
import { MeDto } from "@starterkit/shared/contracts/me";
import { decryptSecret, encryptSecret } from "../../kernel/crypto";
import { db } from "../../kernel/db";
import { ApiError, currentSession } from "../../kernel/errors";
import { isUuid } from "../../kernel/parse";
import { recordActivity } from "../audit";
import {
  type Ctx, deleteUserTokens, endSession, endUserSessions, hashPassword, lockLiveSession, matchTotpStep, newRecoveryCodes, newTotpSecret,
  oauthOnly, otpauthUrl, reauth, stampReauth, userById, type UserRow,
} from "../auth";
import { otherIdentities, unlinkIdentity } from "../oauth";
import { disableTotp, duplicateOf, enableTotp, lockUser, startTotp, updateUser } from "../users";

/** A unique index refused the write (the driver error arrives wrapped by Drizzle). */
const isUniqueViolation = (e: unknown) => ((e as { cause?: { errno?: string } }).cause ?? (e as { errno?: string })).errno === "23505";
const target = (u: UserRow, name = u.name) => ({ type: "user", id: u.id, label: name });
const ALREADY_ON = "Two-factor authentication is already on. Turn it off first to set up a new device.";
const WRONG_CODE = "That code didn't match. Enter the current code from your authenticator app.";

/** The user as /v1/me answers it to a session (`reauthFresh`: it proved the user recently): parse drops the secret fields. */
export const toMe = (u: UserRow, reauthFresh: boolean): MeDtoType => MeDto.parse({ ...u, hasPassword: u.passwordHash !== null, reauthFresh });

/** The user read again after a change. */
const freshMe = async (ctx: Ctx): Promise<MeDtoType> => toMe((await userById(ctx.user.id))!, ctx.reauthFresh);

/**
 * Own name and email. The username can't change here. A new email (other than a change of letter case) is the sign-in
 * identity, so it needs `currentPassword`; an account that signs in only through Google or Apple keeps the provider's
 * email. A new email spends the user's reset and invitation links. Nothing changed = no activity entry.
 */
export async function updateProfile(ctx: Ctx, b: UpdateProfileBody): Promise<MeDtoType> {
  const u = ctx.user;
  if (b.email !== undefined && b.email.toLowerCase() !== u.email.toLowerCase()) {
    if (oauthOnly(u)) throw new ApiError("self_action", "Your email is the sign-in identity of your connected Google or Apple account, so it can't change here.");
    if (b.currentPassword === undefined) throw new ApiError("bad_request", "Enter your current password to change your email.");
    await reauth(u, { password: b.currentPassword });
  }
  const DUPLICATE = () => new ApiError("duplicate", "Another user already has this email. Use a different one.");
  try {
    await db.transaction(async (tx) => {
      const cur = (await lockUser(tx, u.id))!;
      const name = b.name ?? cur.name;
      const email = b.email ?? cur.email;
      if (name === cur.name && email === cur.email) return;
      if (email.toLowerCase() !== cur.email.toLowerCase() && (await duplicateOf(tx, undefined, email, u.id))) throw DUPLICATE();
      await updateUser(tx, u.id, { name, email });
      if (email !== cur.email) await deleteUserTokens(tx, u.id); // the links went to the old address
      await recordActivity(tx, ctx, { action: "me.update", target: target(u, name), before: { name: cur.name, email: cur.email }, after: { name, email } });
    });
  } catch (e) {
    throw isUniqueViolation(e) ? DUPLICATE() : e;
  }
  return freshMe(ctx);
}

/** Change own password, then end this user's other sessions (the current one stays) and spend their reset links. */
export async function changePassword(ctx: Ctx, b: ChangePasswordBody): Promise<void> {
  const u = ctx.user;
  if (u.isLdap) throw new ApiError("ldap_password");
  await reauth(u, { password: b.current });
  const hash = await hashPassword(b.next);
  await db.transaction(async (tx) => {
    await lockUser(tx, u.id);
    await updateUser(tx, u.id, { passwordHash: hash });
    await endUserSessions(tx, u.id, ctx.sid);
    await deleteUserTokens(tx, u.id);
    await recordActivity(tx, ctx, { action: "me.password", target: target(u) });
  });
}

/**
 * Start: a fresh pending secret (encrypted, not active yet) and the otpauth URL for the QR code. An account that signs
 * in only through Google or Apple can't turn it on: the provider checks the user and the sign-in never asks for a code.
 */
export async function startTwoFactor(ctx: Ctx): Promise<{ secret: string; otpauthUrl: string }> {
  const u = ctx.user;
  if (u.twoFactorEnabled) throw new ApiError("already_enabled", ALREADY_ON);
  if (oauthOnly(u)) throw new ApiError("bad_request", "Two-factor authentication doesn't apply to an account that signs in with Google or Apple: the provider checks you.");
  const secret = newTotpSecret();
  await db.transaction(async (tx) => {
    if (!(await startTotp(tx, u.id, encryptSecret(secret)))) throw new ApiError("already_enabled", ALREADY_ON);
    await recordActivity(tx, ctx, { action: "me.2fa_setup", target: target(u) }); // the secret itself is never logged
  });
  return { secret, otpauthUrl: otpauthUrl(secret, u.email, BRAND.name) };
}

/** Confirm with a code from the app: turns 2FA on and returns 8 recovery codes, once (only hashes are stored). */
export async function enableTwoFactor(ctx: Ctx, b: TwoFactorEnableBody): Promise<{ recoveryCodes: string[] }> {
  const u = ctx.user;
  if (!u.pendingTotpSecret) throw new ApiError("bad_request", "Start the setup first, then enter a code from your authenticator app.");
  const step = matchTotpStep(decryptSecret(u.pendingTotpSecret), b.code);
  if (step === null || step <= (u.totpLastStep ?? -Infinity)) throw new ApiError("invalid_code", WRONG_CODE);
  const recoveryCodes = newRecoveryCodes();
  const codeHashes = await Promise.all(recoveryCodes.map(hashPassword));
  await db.transaction(async (tx) => {
    if (!(await enableTotp(tx, u.id, { pending: u.pendingTotpSecret!, step, codeHashes }))) throw new ApiError("invalid_code", WRONG_CODE);
    await recordActivity(tx, ctx, { action: "me.2fa_enable", target: target(u) });
  });
  return { recoveryCodes };
}

/**
 * Turn off with the account password (the directory password for LDAP users); an account that signs in only through
 * Google or Apple has no password and uses an unused recovery code instead.
 */
export async function disableTwoFactor(ctx: Ctx, b: DisableTwoFactorBody): Promise<void> {
  const u = ctx.user;
  const off = () => new ApiError("bad_request", "Two-factor authentication is already off.");
  if (!u.twoFactorEnabled) throw off();
  const only = oauthOnly(u);
  const proof = only ? (b.recoveryCode === undefined ? null : { recoveryCode: b.recoveryCode }) : b.password === undefined ? null : { password: b.password };
  if (!proof) throw new ApiError("bad_request", only ? "Enter one of your recovery codes." : "Enter your current password.");
  await reauth(u, proof);
  await db.transaction(async (tx) => {
    if (!(await disableTotp(tx, u.id))) throw off();
    await recordActivity(tx, ctx, { action: "me.2fa_disable", target: target(u) });
  });
}

/** Refused when it is the only way to sign in (no password, not LDAP, nothing else connected). */
export async function disconnect(ctx: Ctx, provider: ConnectionProvider): Promise<MeDtoType> {
  const u = ctx.user;
  await db.transaction(async (tx) => {
    const cur = (await lockUser(tx, u.id))!;
    if (!cur.hasPassword && !u.isLdap && (await otherIdentities(tx, u.id, provider)) === 0) {
      throw new ApiError("only_sign_in_method", "This is your only way to sign in. Set a password or connect another account first.");
    }
    // a provider that isn't linked changes nothing, so it leaves no entry
    if (await unlinkIdentity(tx, u.id, provider)) await recordActivity(tx, ctx, { action: "me.disconnect", target: target(u), before: { provider } });
  });
  return freshMe(ctx);
}

/**
 * Prove the user again on this session before connecting Google or Apple: the account password (the directory password
 * for LDAP users), or, for an account without a password, an unused recovery code (spent). One without either has no
 * second proof and signs in again instead. An auth step, not a change: no activity entry, and the sign-in log has no
 * event for it.
 */
export async function confirmIdentity(ctx: Ctx, b: ReauthBody): Promise<void> {
  const u = ctx.user;
  const only = oauthOnly(u);
  if (only && !u.twoFactorEnabled) throw new ApiError("bad_request", "Sign in again to connect another account.");
  const proof = only ? (b.recoveryCode === undefined ? null : { recoveryCode: b.recoveryCode }) : b.password === undefined ? null : { password: b.password };
  if (!proof) throw new ApiError("bad_request", only ? "Enter one of your recovery codes." : "Enter your current password.");
  await reauth(u, proof);
  await stampReauth(ctx.sid);
}

/** End one of your own other sessions. Someone else's id, or an ended session, answers like an unknown one (404). */
export async function endOwnSession(ctx: Ctx, id: string): Promise<void> {
  const gone = () => new ApiError("not_found", "This session doesn't exist or has already ended.");
  if (!isUuid(id)) throw gone();
  await db.transaction(async (tx) => {
    const s = await lockLiveSession(tx, ctx.user.id, id);
    if (!s) throw gone();
    if (id === ctx.sid) throw currentSession();
    await endSession(id, tx);
    await recordActivity(tx, ctx, { action: "me.session_end", target: { type: "session", id, label: s.device } });
  });
}
