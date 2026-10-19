import { apiError, badRequest, blocked, json, notFound, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, toUserDto } from "@/lib/server/mock/db";
import { checkUserChange } from "@/lib/server/mock/rules";
import { dropTokens, duplicateOf, endSessions, roleGrantDenied, rolesExist, userDetail } from "@/lib/server/users";
import { UpdateUserBody } from "@/lib/shared/contracts/users";

type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "user.view", async (ctx) => {
    const u = userDetail(id, ctx);
    return u ? json(u) : notFound("user");
  });
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const body = UpdateUserBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "user.edit", async (ctx) => {
    const u = db().users.get(id);
    if (!u) return notFound("user");
    if (!body.success) return badRequest();
    const b = body.data;
    if (b.roles && !rolesExist(b.roles)) return apiError(400, "bad_request", "One of the roles doesn't exist. Pick roles from the list.");
    if (duplicateOf(b.username, b.email, id)) return apiError(409, "duplicate", "Another user already has this username or email. Use different ones.");
    const roles = b.roles && [...new Set(b.roles)];
    const rolesChange = roles && (roles.length !== u.roles.length || roles.some((r) => !u.roles.includes(r)));
    if (roles && rolesChange) {
      const denied = roleGrantDenied(ctx.perms, [...roles.filter((r) => !u.roles.includes(r)), ...u.roles.filter((r) => !roles.includes(r))]);
      if (denied) return denied;
    }
    const deactivate = b.isActive === false && u.isActive;
    if (rolesChange) { const c = checkUserChange(ctx.user, u, { kind: "setRoles", roles }, db()); if (c) return blocked(c); }
    if (deactivate) { const c = checkUserChange(ctx.user, u, { kind: "deactivate" }, db()); if (c) return blocked(c); }
    const before = toUserDto(u);
    if (b.name !== undefined) u.name = b.name;
    if (b.username !== undefined) u.username = b.username;
    if (b.email !== undefined) u.email = b.email;
    if (b.isActive !== undefined) u.isActive = b.isActive;
    if (roles) u.roles = roles;
    if (deactivate) endSessions(id);
    const after = toUserDto(u);
    recordActivity(ctx, { action: "user.update", target: { type: "user", id, label: u.name }, before, after });
    return json(after);
  });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "user.delete", async (ctx) => {
    const u = db().users.get(id);
    if (!u) return notFound("user");
    const c = checkUserChange(ctx.user, u, { kind: "delete" }, db());
    if (c) return blocked(c);
    const before = toUserDto(u);
    db().users.delete(id);
    db().ldapDirectory.delete(id);
    endSessions(id);
    dropTokens(id);
    recordActivity(ctx, { action: "user.delete", target: { type: "user", id, label: before.name }, before });
    return json({ ok: true });
  });
}
