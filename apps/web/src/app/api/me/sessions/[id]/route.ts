import { apiError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";

/** End one of your own other sessions. Someone else's id answers like an unknown one (404). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return withPermission(req, null, async (ctx) => {
    const s = db().sessions.get(id);
    if (!s || s.userId !== ctx.user.id) return apiError(404, "not_found", "This session doesn't exist or has already ended.");
    if (id === ctx.sid) return apiError(409, "self_action", "This is the session you're using. Sign out instead.");
    db().sessions.delete(id);
    recordActivity(ctx, { action: "me.session_end", target: { type: "session", id, label: s.device } });
    return json({ ok: true });
  });
}
