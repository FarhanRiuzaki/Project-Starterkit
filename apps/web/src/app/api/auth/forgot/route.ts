import { randomBytes } from "node:crypto";
import { clientIp, crossSite, handleError, json, sameOrigin } from "@/lib/server/api";
import { log } from "@/lib/server/logger";
import { db } from "@/lib/server/mock/db";
import { hashToken } from "@/lib/server/mock/password";
import { forgotLimits } from "@/lib/server/ratelimit";
import { ForgotPasswordBody } from "@starterkit/shared/contracts/auth";

const TTL_MS = 30 * 60_000;

/**
 * Request a reset link. The answer is the same whether or not the email belongs to an account, and whether or not the
 * request was throttled (forgotLimits: per IP and per email; a throttled request sends nothing). For an active,
 * non-LDAP user a random token (stored hashed, 30 minutes, single use) goes out by "email": the server log (mock).
 */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  try {
    const { email } = ForgotPasswordBody.parse(await req.json().catch(() => null));
    const user = [...db().users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
    // Both limiters count every request (known email or not), so throttling reveals nothing either.
    const allowed = [forgotLimits.ip.allow(clientIp(req)), forgotLimits.email.allow(email.toLowerCase())].every(Boolean);
    if (allowed && user?.isActive && !user.isLdap) {
      const tokens = db().resetTokens;
      const now = Date.now();
      // Expired links and this user's earlier link go: the Map holds at most one live link per user.
      for (const [k, t] of tokens) if (t.expiresAt <= now || t.userId === user.id) tokens.delete(k);
      const token = randomBytes(32).toString("base64url");
      tokens.set(hashToken(token), { userId: user.id, expiresAt: now + TTL_MS });
      log.info({ userId: user.id, link: `/reset-password?token=${token}` }, "mock email: password reset link");
    }
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
