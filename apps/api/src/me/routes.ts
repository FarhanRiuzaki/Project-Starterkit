// /v1/me*: port of apps/web/src/app/api/me/**. Connecting Google or Apple is the OAuth flow's link mode
// (auth/routes.ts). Nothing here lowers the number of active Superadmins (no role, status or delete change), so
// SUPERADMIN_LOCK isn't taken. Checks that read the user lock its row in the transaction and re-read what they decide on.
import { Hono } from "hono";
import { BRAND } from "@starterkit/shared/brand";
import { ChangePasswordBody, ConnectionProvider, DisableTwoFactorBody, type MeDto as MeDtoType, MeDto, SessionListQuery, TwoFactorEnableBody, UpdateProfileBody } from "@starterkit/shared/contracts/me";
import { recordActivity } from "../audit/record";
import { decryptSecret, encryptSecret } from "../auth/crypto";
import { hashPassword } from "../auth/password";
import { endUserSessions, sessionLive, type UserRow } from "../auth/sessions";
import { oauthOnly, reauth, userById } from "../auth/sign-in";
import { matchTotpStep, newRecoveryCodes, newTotpSecret, otpauthUrl } from "../auth/totp";
import { sql, type Tx } from "../db/client";
import { ApiError, currentSession } from "../http/errors";
import { guard } from "../http/guard";
import type { AppEnv } from "../http/middleware";
import { body, isUuid, query } from "../http/parse";
import { duplicateOf, sessionPage } from "../users/queries";

export const meRoutes = new Hono<AppEnv>();

const isUniqueViolation = (e: unknown) => (e as { errno?: string }).errno === "23505";
const target = (u: UserRow, name = u.name) => ({ type: "user", id: u.id, label: name });
const toMe = (u: UserRow): MeDtoType => MeDto.parse({ ...u, hasPassword: u.passwordHash !== null }); // parse drops the secret fields
const lockUser = (tx: Tx, id: string) => tx`select id from users where id = ${id} for update`;

meRoutes.get("/me", async (c) => c.json(toMe((await guard(c, null)).user)));

/**
 * Own name and email. The username can't change here. A new email (other than a change of letter case) is the sign-in
 * identity, so it needs `currentPassword`; an account that signs in only through Google or Apple keeps the provider's
 * email. Nothing changed = 200 and no activity entry.
 */
meRoutes.patch("/me", async (c) => {
  const ctx = await guard(c, null);
  const b = await body(c, UpdateProfileBody);
  const u = ctx.user;
  if (b.email !== undefined && b.email.toLowerCase() !== u.email.toLowerCase()) {
    if (oauthOnly(u)) throw new ApiError("self_action", "Your email is the sign-in identity of your connected Google or Apple account, so it can't change here.");
    if (b.currentPassword === undefined) throw new ApiError("bad_request", "Enter your current password to change your email.");
    await reauth(u, { password: b.currentPassword });
  }
  const DUPLICATE = () => new ApiError("duplicate", "Another user already has this email. Use a different one.");
  try {
    await sql.begin(async (tx) => {
      await lockUser(tx, u.id);
      const [cur] = await tx`select name, email from users where id = ${u.id}`;
      const name = b.name ?? cur.name;
      const email = b.email ?? cur.email;
      if (name === cur.name && email === cur.email) return;
      if (email.toLowerCase() !== cur.email.toLowerCase() && (await duplicateOf(tx, undefined, email, u.id))) throw DUPLICATE();
      await tx`update users set name = ${name}, email = ${email}, updated_at = now() where id = ${u.id}`;
      await recordActivity(tx, ctx, { action: "me.update", target: target(u, name), before: { name: cur.name, email: cur.email }, after: { name, email } });
    });
  } catch (e) {
    throw isUniqueViolation(e) ? DUPLICATE() : e;
  }
  return c.json(toMe((await userById(u.id))!));
});

/** Change own password, then end this user's other sessions (the current one stays) and spend their reset links. */
meRoutes.post("/me/password", async (c) => {
  const ctx = await guard(c, null);
  const b = await body(c, ChangePasswordBody);
  const u = ctx.user;
  if (u.isLdap) throw new ApiError("ldap_password");
  await reauth(u, { password: b.current });
  const hash = await hashPassword(b.next);
  await sql.begin(async (tx) => {
    await lockUser(tx, u.id);
    await tx`update users set password_hash = ${hash}, updated_at = now() where id = ${u.id}`;
    await endUserSessions(tx, u.id, ctx.sid);
    await tx`delete from user_tokens where user_id = ${u.id}`;
    await recordActivity(tx, ctx, { action: "me.password", target: target(u) });
  });
  return c.json({ ok: true });
});

/**
 * Start: a fresh pending secret (encrypted, not active yet) and the otpauth URL for the QR code. An account that signs
 * in only through Google or Apple can't turn it on: the provider checks the user and the sign-in never asks for a code.
 */
meRoutes.post("/me/2fa", async (c) => {
  const ctx = await guard(c, null);
  const u = ctx.user;
  if (u.twoFactorEnabled) throw new ApiError("already_enabled", "Two-factor authentication is already on. Turn it off first to set up a new device.");
  if (oauthOnly(u)) throw new ApiError("bad_request", "Two-factor authentication doesn't apply to an account that signs in with Google or Apple: the provider checks you.");
  const secret = newTotpSecret();
  await sql.begin(async (tx) => {
    const done = await tx`update users set pending_totp_secret = ${encryptSecret(secret)}, updated_at = now() where id = ${u.id} and totp_secret is null returning 1`;
    if (!done.length) throw new ApiError("already_enabled", "Two-factor authentication is already on. Turn it off first to set up a new device.");
    await recordActivity(tx, ctx, { action: "me.2fa_setup", target: target(u) }); // the secret itself is never logged
  });
  return c.json({ secret, otpauthUrl: otpauthUrl(secret, u.email, BRAND.name) });
});

/** Confirm with a code from the app: turns 2FA on and returns 8 recovery codes, once (only hashes are stored). */
meRoutes.put("/me/2fa", async (c) => {
  const ctx = await guard(c, null);
  const b = await body(c, TwoFactorEnableBody);
  const u = ctx.user;
  if (!u.pendingTotpSecret) throw new ApiError("bad_request", "Start the setup first, then enter a code from your authenticator app.");
  const step = matchTotpStep(decryptSecret(u.pendingTotpSecret), b.code);
  if (step === null || step <= (u.totpLastStep ?? -Infinity)) {
    throw new ApiError("invalid_code", "That code didn't match. Enter the current code from your authenticator app.");
  }
  const recoveryCodes = newRecoveryCodes();
  const hashes = await Promise.all(recoveryCodes.map(hashPassword));
  await sql.begin(async (tx) => {
    // the pending secret is still the one the code matched (a second setup in between would have replaced it)
    const done = await tx`update users set totp_secret = pending_totp_secret, pending_totp_secret = null, totp_last_step = ${step}, updated_at = now()
      where id = ${u.id} and pending_totp_secret = ${u.pendingTotpSecret} and totp_secret is null returning 1`;
    if (!done.length) throw new ApiError("invalid_code", "That code didn't match. Enter the current code from your authenticator app.");
    await tx`delete from recovery_codes where user_id = ${u.id}`;
    await tx`insert into recovery_codes ${tx(hashes.map((code_hash) => ({ id: Bun.randomUUIDv7(), user_id: u.id, code_hash })))}`;
    await recordActivity(tx, ctx, { action: "me.2fa_enable", target: target(u) });
  });
  return c.json({ recoveryCodes });
});

/**
 * Turn off with the account password (the directory password for LDAP users); an account that signs in only through
 * Google or Apple has no password and uses an unused recovery code instead.
 */
meRoutes.delete("/me/2fa", async (c) => {
  const ctx = await guard(c, null);
  const b = await body(c, DisableTwoFactorBody);
  const u = ctx.user;
  const off = () => new ApiError("bad_request", "Two-factor authentication is already off.");
  if (!u.twoFactorEnabled) throw off();
  const only = oauthOnly(u);
  const proof = only ? (b.recoveryCode === undefined ? null : { recoveryCode: b.recoveryCode }) : b.password === undefined ? null : { password: b.password };
  if (!proof) throw new ApiError("bad_request", only ? "Enter one of your recovery codes." : "Enter your current password.");
  await reauth(u, proof);
  await sql.begin(async (tx) => {
    const done = await tx`update users set totp_secret = null, pending_totp_secret = null, updated_at = now() where id = ${u.id} and totp_secret is not null returning 1`;
    if (!done.length) throw off();
    await tx`delete from recovery_codes where user_id = ${u.id}`;
    await recordActivity(tx, ctx, { action: "me.2fa_disable", target: target(u) });
  });
  return c.json({ ok: true });
});

/** Refused when it is the only way to sign in (no password, not LDAP, nothing else connected). */
meRoutes.delete("/me/connections/:provider", async (c) => {
  const ctx = await guard(c, null);
  const provider = ConnectionProvider.parse(c.req.param("provider"));
  const u = ctx.user;
  await sql.begin(async (tx) => {
    await lockUser(tx, u.id);
    const [cur] = await tx`select password_hash is not null as has_password,
      (select count(*)::int from user_identities where user_id = ${u.id} and provider <> ${provider}) as rest from users where id = ${u.id}`;
    if (!cur.has_password && !u.isLdap && cur.rest === 0) {
      throw new ApiError("only_sign_in_method", "This is your only way to sign in. Set a password or connect another account first.");
    }
    // a provider that isn't linked changes nothing, so it leaves no entry
    if ((await tx`delete from user_identities where user_id = ${u.id} and provider = ${provider} returning 1`).length) {
      await recordActivity(tx, ctx, { action: "me.disconnect", target: target(u), before: { provider } });
    }
  });
  return c.json(toMe((await userById(u.id))!));
});

/** One page of the caller's own sessions, newest activity first unless `sort` says otherwise. */
meRoutes.get("/me/sessions", async (c) => {
  const q = query(c, SessionListQuery);
  const ctx = await guard(c, null);
  return c.json(await sessionPage(ctx.user.id, q, ctx.sid));
});

/** End one of your own other sessions. Someone else's id, or an ended session, answers like an unknown one (404). */
meRoutes.delete("/me/sessions/:id", async (c) => {
  const ctx = await guard(c, null);
  const id = c.req.param("id");
  const gone = () => new ApiError("not_found", "This session doesn't exist or has already ended.");
  if (!isUuid(id)) throw gone();
  await sql.begin(async (tx) => {
    const [s] = await tx`select s.device from sessions s where s.id = ${id} and s.user_id = ${ctx.user.id} and ${sessionLive()} for update`;
    if (!s) throw gone();
    if (id === ctx.sid) throw currentSession();
    await tx`delete from sessions where id = ${id}`;
    await recordActivity(tx, ctx, { action: "me.session_end", target: { type: "session", id, label: s.device } });
  });
  return c.json({ ok: true });
});
