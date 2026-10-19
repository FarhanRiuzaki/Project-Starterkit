import { randomBytes } from "node:crypto";
import { apiError, badRequest, json, tooManyAttempts, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { secureEquals } from "@/lib/server/csrf";
import { db, type UserRecord } from "@/lib/server/mock/db";
import { hashRecoveryCode, verifyPassword } from "@/lib/server/mock/password";
import { passwordFails, passwordKey, retryText } from "@/lib/server/ratelimit";
import { matchTotpStep, newTotpSecret, otpauthUrl } from "@/lib/server/totp";
import { BRAND } from "@/lib/shared/brand";
import { DisableTwoFactorBody, TwoFactorEnableBody } from "@/lib/shared/contracts/me";

const target = (u: UserRecord) => ({ type: "user", id: u.id, label: u.name });

/** `xxxx-xxxx`, 8 hex characters from the CSPRNG (the format the sign-in step accepts). */
const recoveryCode = () => { const h = randomBytes(4).toString("hex"); return `${h.slice(0, 4)}-${h.slice(4)}`; };

/** Start: a fresh pending secret (not active yet) and the otpauth URL for the QR code. */
export async function POST(req: Request): Promise<Response> {
  return withPermission(req, null, async (ctx) => {
  const u = ctx.user;
  if (u.twoFactorEnabled) return apiError(409, "duplicate", "Two-factor authentication is already on. Turn it off first to set up a new device.");
  u.pendingTotpSecret = newTotpSecret();
  recordActivity(ctx, { action: "me.2fa_setup", target: target(u) }); // the secret itself is never logged
  return json({ secret: u.pendingTotpSecret, otpauthUrl: otpauthUrl(u.pendingTotpSecret, u.email, BRAND.name) });
  });
}

/** Confirm with a code from the app: turns 2FA on and returns 8 recovery codes, once (only hashes are stored). */
export async function PUT(req: Request): Promise<Response> {
  const body = TwoFactorEnableBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, null, async (ctx) => {
    if (!body.success) return badRequest();
    const u = ctx.user;
    if (!u.pendingTotpSecret) return apiError(400, "bad_request", "Start the setup first, then enter a code from your authenticator app.");
    const step = matchTotpStep(u.pendingTotpSecret, body.data.code);
    if (step === null || step <= (u.totpLastStep ?? -Infinity)) {
      return apiError(400, "invalid_code", "That code didn't match. Enter the current code from your authenticator app.");
    }
    const recoveryCodes = Array.from({ length: 8 }, recoveryCode);
    Object.assign(u, { twoFactorEnabled: true, totpSecret: u.pendingTotpSecret, totpLastStep: step, recoveryCodes: recoveryCodes.map(hashRecoveryCode) });
    delete u.pendingTotpSecret;
    recordActivity(ctx, { action: "me.2fa_enable", target: target(u) });
    return json({ recoveryCodes });
  });
}

/** Turn off with the account password (the directory password for LDAP users). */
export async function DELETE(req: Request): Promise<Response> {
  const body = DisableTwoFactorBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, null, async (ctx) => {
    if (!body.success) return badRequest();
    const u = ctx.user;
    if (!u.twoFactorEnabled) return apiError(400, "bad_request", "Two-factor authentication is already off.");
    const wait = Math.ceil(passwordFails.retryAfterMs(passwordKey(u.id)) / 1000);
    if (wait > 0) return tooManyAttempts(wait, retryText(wait)); // before verifying anything
    const dir = u.isLdap ? db().ldapDirectory.get(u.id) : undefined;
    const ok = u.isLdap ? dir !== undefined && secureEquals(body.data.password, dir) : !!u.passwordHash && verifyPassword(body.data.password, u.passwordHash);
    if (!ok) {
      passwordFails.fail(passwordKey(u.id));
      return apiError(400, "invalid_credentials", "The password is wrong. Check it and try again.");
    }
    passwordFails.succeed(passwordKey(u.id));
    Object.assign(u, { twoFactorEnabled: false, totpSecret: null, recoveryCodes: [] });
    delete u.pendingTotpSecret;
    recordActivity(ctx, { action: "me.2fa_disable", target: target(u) });
    return json({ ok: true });
  });
}
