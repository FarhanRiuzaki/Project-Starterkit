import { json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";
import { hashPassword } from "@/lib/server/mock/password";
import { checkPasswordOp } from "@/lib/server/mock/rules";
import { blocked, dropTokens, endSessions, notFound, temporaryPassword } from "@/lib/server/users";

/** Admin reset: a random password, shown once in the answer (never logged), and the user's sessions end. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "user.edit", async (ctx) => {
    const u = db().users.get(id);
    if (!u) return notFound();
    if (u.id === ctx.user.id) return blocked("self_action"); // the reset would end the actor's own sessions; use Security
    const c = checkPasswordOp(u);
    if (c) return blocked(c);
    const pw = temporaryPassword();
    u.passwordHash = hashPassword(pw);
    endSessions(id);
    dropTokens(id);
    recordActivity(ctx, { action: "user.reset_password", target: { type: "user", id, label: u.name } });
    return json({ temporaryPassword: pw });
  });
}
