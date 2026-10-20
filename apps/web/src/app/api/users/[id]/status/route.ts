import { badRequest, blocked, json, notFound, withPermission } from "@/lib/server/api";
import { db, toUserDto } from "@/lib/server/mock/db";
import { applyStatus, rankDenied, statusRule } from "@/lib/server/users";
import { SetUserStatusBody } from "@starterkit/shared/contracts/users";

/** Activate or deactivate (the same rule and activity as PATCH isActive). Deactivating ends the user's sessions. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = SetUserStatusBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "user.edit", async (ctx) => {
    if (!body.success) return badRequest();
    const u = db().users.get(id);
    if (!u) return notFound("user");
    const outranked = rankDenied(ctx, u);
    if (outranked) return outranked;
    const c = statusRule(ctx, u, body.data.active);
    if (c) return blocked(c);
    applyStatus(ctx, u, body.data.active);
    return json(toUserDto(u));
  });
}
