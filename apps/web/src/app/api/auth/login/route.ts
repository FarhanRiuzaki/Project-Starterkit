import { randomUUID } from "node:crypto";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { apiError, clientIp, crossSite, handleError, json, sameOrigin, tooManyAttempts } from "@/lib/server/api";
import { secureEquals } from "@/lib/server/csrf";
import { db, type UserRecord } from "@/lib/server/mock/db";
import { hashPassword, verifyPassword } from "@/lib/server/mock/password";
import { loginGate, loginLimits, retryText } from "@/lib/server/ratelimit";
import { getSession } from "@/lib/server/session";
import { completeSignIn, findUser, logAuth } from "@/lib/server/sign-in";
import { LoginBody } from "@/lib/shared/contracts/auth";

let dummy: string | undefined;
/** A hash no password matches: scrypt runs for unknown logins too, so the answer time doesn't reveal which exist. */
const dummyHash = () => (dummy ??= hashPassword(randomUUID()));

/** Password users by scrypt hash; LDAP users only by the LDAP method, against the (mock) directory. */
function credentialOk(user: UserRecord | undefined, method: "password" | "ldap", password: string): boolean {
  if (method === "ldap") {
    const dir = user?.isLdap ? db().ldapDirectory.get(user.id) : undefined;
    return secureEquals(password, dir ?? "\0") && dir !== undefined;
  }
  const hash = user && !user.isLdap ? user.passwordHash : null;
  return verifyPassword(password, hash ?? dummyHash()) && hash !== null;
}

/**
 * Sign-in step 1. Unknown login, wrong password and the wrong method for the account share one answer; an inactive
 * account is named only after the right credential. A user with 2FA gets only the pending marker (no sid, no CSRF).
 */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  try {
    const body = LoginBody.parse(await req.json().catch(() => null));
    const user = findUser(body.login);
    const name = (user?.username ?? body.login.trim()).toLowerCase();
    const fail = () => logAuth(req, "login_failed", body.method, body.login, user?.id ?? null);
    // Synchronous gate (counts the attempt before any await); the reserved failure stays unless the credential is right.
    const wait = loginGate(loginLimits, { step: "login", ip: clientIp(req), username: name });
    if (wait != null) {
      fail();
      return tooManyAttempts(wait, retryText(wait));
    }
    const ok = credentialOk(user, body.method, body.password);
    if (!ok || !user) {
      fail();
      return apiError(401, "invalid_credentials", "The sign-in details don't match an account. Check them and the sign-in method, then try again.");
    }
    const twoFactor = user.twoFactorEnabled && !!user.totpSecret;
    // With 2FA the sign-in isn't won yet: drop only this attempt's reservation, so earlier OTP failures keep counting.
    if (twoFactor) loginLimits.user.release(name);
    else loginLimits.user.succeed(name);
    if (!user.isActive) {
      fail();
      return apiError(403, "account_inactive", "This account is inactive. Ask an administrator to reactivate it.");
    }
    const s = await getSession();
    if (twoFactor) {
      if (s.sid) db().sessions.delete(s.sid);
      s.sid = undefined;
      s.csrf = undefined;
      s.pending2fa = { userId: user.id, method: body.method, at: Date.now() };
      await s.save();
      logAuth(req, "login_success", body.method, body.login, user.id);
      const next = afterSignIn(body.next);
      return json({ next: next === "/" ? "/login/2fa" : `/login/2fa?next=${encodeURIComponent(next)}` });
    }
    await completeSignIn(s, user, body.method, req);
    logAuth(req, "login_success", body.method, body.login, user.id);
    return json({ next: afterSignIn(body.next) });
  } catch (e) {
    return handleError(e);
  }
}
