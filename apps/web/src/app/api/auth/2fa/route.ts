import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { apiError, clientIp, handleError, json, tooManyAttempts } from "@/lib/server/api";
import { db, type UserRecord } from "@/lib/server/mock/db";
import { hashRecoveryCode } from "@/lib/server/mock/password";
import { loginGate, loginLimits, retryText } from "@/lib/server/ratelimit";
import { getSession } from "@/lib/server/session";
import { completeSignIn, logAuth } from "@/lib/server/sign-in";
import { verifyTotp } from "@/lib/server/totp";
import { TwoFactorBody } from "@/lib/shared/contracts/auth";

/** A matching recovery code is removed, so it works once. */
function spendRecoveryCode(user: UserRecord, code: string): boolean {
  const i = user.recoveryCodes.indexOf(hashRecoveryCode(code));
  if (i < 0) return false;
  user.recoveryCodes.splice(i, 1);
  return true;
}

/** Sign-in step 2: only a cookie with the pending-2FA marker gets here; a 6-digit TOTP or a recovery code finishes it. */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = TwoFactorBody.parse(await req.json().catch(() => null));
    const s = await getSession();
    const p = s.pending2fa;
    const user = p ? db().users.get(p.userId) : undefined;
    if (!p || !user?.totpSecret) return apiError(401, "unauthenticated", "The sign-in expired. Start again with your email and password.");
    const name = user.username.toLowerCase();
    const fail = () => logAuth(req, "2fa_failed", p.method, user.email, user.id);
    const wait = loginGate(loginLimits, { step: "otp", ip: clientIp(req), username: name });
    if (wait != null) {
      fail();
      return tooManyAttempts(wait, retryText(wait));
    }
    if (!verifyTotp(user.totpSecret, body.code) && !spendRecoveryCode(user, body.code)) {
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
