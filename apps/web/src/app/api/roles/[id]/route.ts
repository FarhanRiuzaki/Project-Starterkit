import { apiError, badRequest, blocked, json, notFound, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";
import { checkPermissionGrant, checkRoleChange } from "@/lib/server/mock/rules";
import { inCatalogOrder, renameRoleOnUsers, roleById, roleNameTaken, toRoleDto } from "@/lib/server/rbac";
import { UpdateRoleBody } from "@/lib/shared/contracts/rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withPermission(req, "role.view", async () => {
    const r = roleById(id);
    return r ? json(r) : notFound("role");
  });
}

/**
 * Rename and/or apply `add` / `remove` to the role's current permissions. Superadmin is locked. No escalation: every
 * permission asked to be added or removed must be one the actor holds. A rename moves the role's users to the new
 * name. Nothing to change → 200 with the role, no activity entry.
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
    const { name = r.name, add = [], remove = [] } = body.data;
    if (checkPermissionGrant(ctx.perms, [...add, ...remove])) {
      return apiError(403, "forbidden", "You can only add or remove permissions your own role holds. Ask an administrator who has them.");
    }
    if (roleNameTaken(name, id)) return apiError(409, "duplicate", "Another role already has this name. Use a different one.");
    const added = inCatalogOrder(add.filter((p) => !r.permissions.includes(p)));
    const removed = inCatalogOrder(remove.filter((p) => r.permissions.includes(p)));
    if (name === r.name && added.length === 0 && removed.length === 0) return json(toRoleDto(r));
    const before = { name: r.name };
    if (name !== r.name) renameRoleOnUsers(r.name, name);
    r.name = name;
    r.permissions = inCatalogOrder([...r.permissions.filter((p) => !removed.includes(p)), ...added]);
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
