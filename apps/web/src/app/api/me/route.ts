import { apiError, badRequest, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, toUserDto } from "@/lib/server/mock/db";
import { UpdateProfileBody } from "@/lib/shared/contracts/me";

export async function GET(req: Request): Promise<Response> {
  return withPermission(req, null, async (ctx) => json(toUserDto(ctx.user)));
}

/** Own name and email. The username is not in the schema, so it can't change here. */
export async function PATCH(req: Request): Promise<Response> {
  const body = UpdateProfileBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, null, async (ctx) => {
    if (!body.success) return badRequest();
    const { name, email } = body.data;
    const u = ctx.user;
    if (email && [...db().users.values()].some((o) => o.id !== u.id && o.email.toLowerCase() === email.toLowerCase())) {
      return apiError(409, "duplicate", "Another user already has this email. Use a different one.");
    }
    const before = { name: u.name, email: u.email };
    if (name) u.name = name;
    if (email) u.email = email;
    recordActivity(ctx, { action: "me.update", target: { type: "user", id: u.id, label: u.name }, before, after: { name: u.name, email: u.email } });
    return json(toUserDto(u));
  });
}
