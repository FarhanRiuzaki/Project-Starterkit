import { badRequest, blocked, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";
import { hashPassword } from "@/lib/server/mock/password";
import { checkPasswordOp } from "@/lib/server/mock/rules";
import { reauth } from "@/lib/server/sign-in";
import { dropTokens } from "@/lib/server/users";
import { ChangePasswordBody } from "@starterkit/shared/contracts/me";

/** Change own password, then end this user's other sessions (the current one stays) and spend their reset links. */
export async function POST(req: Request): Promise<Response> {
  const body = ChangePasswordBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, null, async (ctx) => {
    if (!body.success) return badRequest();
    const u = ctx.user;
    const c = checkPasswordOp(u);
    if (c) return blocked(c);
    const denied = reauth(u, { password: body.data.current });
    if (denied) return denied;
    u.passwordHash = hashPassword(body.data.next);
    for (const s of db().sessions.values()) if (s.userId === u.id && s.id !== ctx.sid) db().sessions.delete(s.id);
    dropTokens(u.id);
    recordActivity(ctx, { action: "me.password", target: { type: "user", id: u.id, label: u.name } });
    return json({ ok: true });
  });
}
