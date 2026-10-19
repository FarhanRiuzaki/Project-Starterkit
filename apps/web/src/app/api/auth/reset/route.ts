import { apiError, crossSite, handleError, json, sameOrigin } from "@/lib/server/api";
import { log } from "@/lib/server/logger";
import { db } from "@/lib/server/mock/db";
import { hashPassword, hashToken } from "@/lib/server/mock/password";
import { logAuth } from "@/lib/server/sign-in";
import { ResetPasswordBody } from "@/lib/shared/contracts/auth";

/** Set a new password with a reset token. The token is spent on first use, even when expired; the user's sessions end. */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  try {
    const { token, password } = ResetPasswordBody.parse(await req.json().catch(() => null));
    const store = db();
    const key = hashToken(token);
    const rec = store.resetTokens.get(key);
    store.resetTokens.delete(key);
    const user = rec && rec.expiresAt > Date.now() ? store.users.get(rec.userId) : undefined;
    if (!user || user.isLdap) return apiError(400, "invalid_code", "This reset link expired or was already used. Request a new link.");
    user.passwordHash = hashPassword(password);
    for (const [id, sess] of store.sessions) if (sess.userId === user.id) store.sessions.delete(id);
    log.info({ userId: user.id }, "password reset");
    logAuth(req, "password_reset", "password", user.email, user.id);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
