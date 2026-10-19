import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { apiError, clientIp, crossSite, handleError, json, sameOrigin, tooManyAttempts } from "@/lib/server/api";
import { db, type UserRecord } from "@/lib/server/mock/db";
import { hashRecoveryCode } from "@/lib/server/mock/password";
import { loginGate, loginLimits, retryText } from "@/lib/server/ratelimit";
import { getSession, pending2faOf } from "@/lib/server/session";
import { completeSignIn, logAuth } from "@/lib/server/sign-in";
import { matchTotpStep } from "@/lib/server/totp";
import { TwoFactorBody } from "@/lib/shared/contracts/auth";

/** A matching recovery code is removed, so it works once. */
function spendRecoveryCode(user: UserRecord, code: string): boolean {
  const i = user.recoveryCodes.indexOf(hashRecoveryCode(code));
  if (i < 0) return false;
  user.recoveryCodes.splice(i, 1);
  return true;
}

/** A TOTP code newer than the one that last completed a sign-in for this user (replay guard). */
function totpOk(user: UserRecord, secret: string, code: string): boolean {
  const step = matchTotpStep(secret, code);
  if (step === null || step <= (user.totpLastStep ?? -Infinity)) return false;
  user.totpLastStep = step;
  return true;
}

/**
 * Sign-in step 2: only a cookie with a pending-2FA marker younger than 10 minutes gets here (an older one is
 * cleared); a 6-digit TOTP (each one once) or a recovery code (each one once) finishes it.
 */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  try {
    const body = TwoFactorBody.parse(await req.json().catch(() => null));
    const s = await getSession();
    const p = pending2faOf(s);
    const user = p ? db().users.get(p.userId) : undefined;
    if (!p || !user?.totpSecret) {
      if (s.pending2fa) s.destroy();
      return apiError(401, "unauthenticated", "The sign-in expired. Start again with your email and password.");
    }
    const secret = user.totpSecret;
    const name = user.username.toLowerCase();
    const fail = () => logAuth(req, "2fa_failed", p.method, user.email, user.id);
    const wait = loginGate(loginLimits, { step: "otp", ip: clientIp(req), username: name });
    if (wait != null) {
      fail();
      return tooManyAttempts(wait, retryText(wait));
    }
    if (!totpOk(user, secret, body.code) && !spendRecoveryCode(user, body.code)) {
      fail();
      return apiError(400, "invalid_code", "That code didn't match. Enter the current code from your authenticator app or an unused recovery code.");
    }
    loginLimits.user.succeed(name);
    if (!user.isActive) { // deactivated between the two steps
      s.destroy();
      fail();
      return apiError(403, "account_inactive", "This account is inactive. Ask an administrator to reactivate it.");
    }
    await completeSignIn(s, user, p.method, req);
    logAuth(req, "2fa_success", p.method, user.email, user.id);
    return json({ next: afterSignIn(body.next) });
  } catch (e) {
    return handleError(e);
  }
}
