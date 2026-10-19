import { randomUUID } from "node:crypto";
import { apiError, badRequest, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, type RoleRecord } from "@/lib/server/mock/db";
import { checkPermissionGrant } from "@/lib/server/mock/rules";
import { inCatalogOrder, listRoles, roleNameTaken, toRoleDto } from "@/lib/server/rbac";
import { CreateRoleBody } from "@/lib/shared/contracts/rbac";

export async function GET(req: Request): Promise<Response> {
  return withPermission(req, "role.view", async () => json(listRoles()));
}

/** New role, empty unless `permissions` is given; it may carry only permissions the actor holds. */
export async function POST(req: Request): Promise<Response> {
  const body = CreateRoleBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "role.create", async (ctx) => {
    if (!body.success) return badRequest();
    const permissions = inCatalogOrder(body.data.permissions);
    if (checkPermissionGrant(ctx.perms, permissions)) {
      return apiError(403, "forbidden", "Your role doesn't hold every permission you picked. Leave those out, or ask an administrator who has them.");
    }
    if (roleNameTaken(body.data.name)) return apiError(409, "duplicate", "Another role already has this name. Use a different one.");
    const role: RoleRecord = { id: `role-${randomUUID()}`, name: body.data.name, locked: false, permissions };
    db().roles.set(role.id, role);
    recordActivity(ctx, { action: "role.create", target: { type: "role", id: role.id, label: role.name }, after: { name: role.name, added: permissions, removed: [] } });
    return json(toRoleDto(role), 201);
  });
}
