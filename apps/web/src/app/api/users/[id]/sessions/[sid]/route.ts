import { apiError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";
import { blocked } from "@/lib/server/users";

/** End one session of another user. A session that isn't theirs answers like an unknown one. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; sid: string }> }): Promise<Response> {
  const { id, sid } = await params;
  return withPermission(req, "user.edit", async (ctx) => {
    const s = db().sessions.get(sid);
    const u = db().users.get(id);
    if (!s || !u || s.userId !== id) return apiError(404, "not_found", "This session doesn't exist or has already ended.");
    if (sid === ctx.sid) return blocked("self_action");
    db().sessions.delete(sid);
    recordActivity(ctx, { action: "user.session_end", target: { type: "user", id, label: u.name }, after: { session: s.device } });
    return json({ ok: true });
  });
}
