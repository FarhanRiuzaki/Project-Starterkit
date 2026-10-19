import { randomUUID } from "node:crypto";
import { apiError, badRequest, handleError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, type RoleRecord } from "@/lib/server/mock/db";
import { checkPermissionGrant } from "@/lib/server/mock/rules";
import { paginate } from "@/lib/server/paginate";
import { inCatalogOrder, listRoles, ROLE_SORTERS, roleNameTaken, toRoleDto } from "@/lib/server/rbac";
import { CreateRoleBody, RoleListQuery } from "@/lib/shared/contracts/rbac";

/** One page of roles, name A–Z unless `sort` says otherwise; `q` matches the name. */
export async function GET(req: Request): Promise<Response> {
  const parsed = RoleListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "role.view", async () => {
    const needle = q.q?.trim().toLowerCase();
    return json(paginate(listRoles().filter((r) => !needle || r.name.toLowerCase().includes(needle)), q, ROLE_SORTERS, "name"));
  });
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
