import { apiError, badRequest, blocked, json, notFound, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";
import { checkPermissionGrant, checkRoleChange } from "@/lib/server/mock/rules";
import { inCatalogOrder, renameRoleOnUsers, roleNameTaken, toRoleDto } from "@/lib/server/rbac";
import { UpdateRoleBody } from "@/lib/shared/contracts/rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "role.view", async () => {
    const r = db().roles.get(id);
    return r ? json(toRoleDto(r)) : notFound("role");
  });
}

/**
 * Rename and/or replace the permission set. Superadmin is locked. No escalation: every permission added or removed
 * must be one the actor holds. A rename moves the role's users to the new name.
 */
export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const body = UpdateRoleBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "role.edit", async (ctx) => {
    const r = db().roles.get(id);
    if (!r) return notFound("role");
    if (!body.success) return badRequest();
    const c = checkRoleChange(r, "edit", db());
    if (c) return blocked(c);
    const { name = r.name } = body.data;
    const next = body.data.permissions ? inCatalogOrder(body.data.permissions) : r.permissions;
    const added = next.filter((p) => !r.permissions.includes(p));
    const removed = r.permissions.filter((p) => !next.includes(p));
    if (checkPermissionGrant(ctx.perms, [...added, ...removed])) {
      return apiError(403, "forbidden", "You can only add or remove permissions your own role holds. Ask an administrator who has them.");
    }
    if (roleNameTaken(name, id)) return apiError(409, "duplicate", "Another role already has this name. Use a different one.");
    const before = { name: r.name };
    if (name !== r.name) renameRoleOnUsers(r.name, name);
    r.name = name;
    r.permissions = next;
    recordActivity(ctx, { action: "role.update", target: { type: "role", id, label: r.name }, before, after: { name, added, removed } });
    return json(toRoleDto(r));
  });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "role.delete", async (ctx) => {
    const r = db().roles.get(id);
    if (!r) return notFound("role");
    const c = checkRoleChange(r, "delete", db());
    if (c) return blocked(c);
    db().roles.delete(id);
    recordActivity(ctx, { action: "role.delete", target: { type: "role", id, label: r.name }, before: { name: r.name, permissions: r.permissions } });
    return json({ ok: true });
  });
}
