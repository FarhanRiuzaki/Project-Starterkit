import { apiError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, toUserDto } from "@/lib/server/mock/db";
import { checkUserChange } from "@/lib/server/mock/rules";
import { blocked, endSessions, notFound } from "@/lib/server/users";
import { SetUserStatusBody } from "@/lib/shared/contracts/users";

/** Activate or deactivate. Deactivating ends the user's sessions. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = SetUserStatusBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "user.edit", async (ctx) => {
    const u = db().users.get(id);
    if (!u) return notFound();
    if (!body.success) return apiError(400, "bad_request", "A request parameter has an unsupported value.");
    const { active } = body.data;
    if (!active) { const c = checkUserChange(ctx.user, u, { kind: "deactivate" }, db()); if (c) return blocked(c); }
    u.isActive = active;
    if (!active) endSessions(id);
    recordActivity(ctx, { action: active ? "user.activate" : "user.deactivate", target: { type: "user", id, label: u.name }, before: { isActive: !active }, after: { isActive: active } });
    return json(toUserDto(u));
  });
}
