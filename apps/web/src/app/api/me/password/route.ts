import { apiError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";
import { hashPassword, verifyPassword } from "@/lib/server/mock/password";
import { checkPasswordOp } from "@/lib/server/mock/rules";
import { ChangePasswordBody } from "@/lib/shared/contracts/me";

/** Change own password, then end this user's other sessions (the current one stays). */
export async function POST(req: Request): Promise<Response> {
  const body = ChangePasswordBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, null, async (ctx) => {
    if (!body.success) return apiError(400, "bad_request", "A request parameter has an unsupported value.");
    const u = ctx.user;
    if (checkPasswordOp(u)) return apiError(409, "ldap_password", "This account signs in with the directory password. Change it in your directory.");
    if (!u.passwordHash || !verifyPassword(body.data.current, u.passwordHash)) {
      // 400, not 401: a 401 would make the browser think the session ended
      return apiError(400, "invalid_credentials", "The current password is wrong. Check it and try again.");
    }
    u.passwordHash = hashPassword(body.data.next);
    for (const s of db().sessions.values()) if (s.userId === u.id && s.id !== ctx.sid) db().sessions.delete(s.id);
    recordActivity(ctx, { action: "me.password", target: { type: "user", id: u.id, label: u.name } });
    return json({ ok: true });
  });
}
