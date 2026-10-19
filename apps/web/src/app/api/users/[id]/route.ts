import { apiError, badRequest, blocked, json, notFound, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, toUserDto } from "@/lib/server/mock/db";
import { checkUserChange } from "@/lib/server/mock/rules";
import {
  applyStatus, canonicalRoles, dropTokens, duplicateOf, endSessions, rankDenied, roleGrantDenied, statusRule, unknownRole, userDetail,
} from "@/lib/server/users";
import { UpdateUserBody, type UserDto } from "@/lib/shared/contracts/users";

type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "user.view", async (ctx) => {
    const u = userDetail(id, ctx);
    return u ? json(u) : notFound("user");
  });
}

const FIELDS = ["name", "username", "email", "roles"] as const satisfies readonly (keyof UserDto)[];

/**
 * Edit name, username, email, roles and status. Every rule is checked before anything changes. Changed fields log one
 * user.update entry with only those fields; a status change logs user.activate / user.deactivate (applyStatus, as
 * POST /status). Nothing to change → 200 with the user, no activity entry.
 */
export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const body = UpdateUserBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "user.edit", async (ctx) => {
    if (!body.success) return badRequest();
    const u = db().users.get(id);
    if (!u) return notFound("user");
    const outranked = rankDenied(ctx, u);
    if (outranked) return outranked;
    const b = body.data;
    const roles = b.roles ? canonicalRoles(b.roles) : undefined;
    if (roles === null) return unknownRole();
    if (duplicateOf(b.username, b.email, id)) return apiError(409, "duplicate", "Another user already has this username or email. Use different ones.");
    const rolesChange = !!roles && (roles.length !== u.roles.length || roles.some((r) => !u.roles.includes(r)));
    if (roles && rolesChange) {
      const denied = roleGrantDenied(ctx.perms, [...roles.filter((r) => !u.roles.includes(r)), ...u.roles.filter((r) => !roles.includes(r))]);
      if (denied) return denied;
      const c = checkUserChange(ctx.user, u, { kind: "setRoles", roles }, db());
      if (c) return blocked(c);
    }
    const statusChange = b.isActive !== undefined && b.isActive !== u.isActive;
    if (statusChange) { const c = statusRule(ctx, u, b.isActive!); if (c) return blocked(c); }
    const before = toUserDto(u);
    if (b.name !== undefined) u.name = b.name;
    if (b.username !== undefined) u.username = b.username;
    if (b.email !== undefined) u.email = b.email;
    if (roles && rolesChange) u.roles = roles;
    const after = toUserDto(u);
    const changed = FIELDS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (changed.length) {
      const pick = (d: UserDto) => Object.fromEntries(changed.map((k) => [k, d[k]]));
      recordActivity(ctx, { action: "user.update", target: { type: "user", id, label: u.name }, before: pick(before), after: pick(after) });
    }
    if (statusChange) applyStatus(ctx, u, b.isActive!);
    return json(toUserDto(u));
  });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "user.delete", async (ctx) => {
    const u = db().users.get(id);
    if (!u) return notFound("user");
    const outranked = rankDenied(ctx, u);
    if (outranked) return outranked;
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
