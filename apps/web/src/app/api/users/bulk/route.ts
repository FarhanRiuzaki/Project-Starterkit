import { apiError, handleError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, toUserDto, type UserRecord } from "@/lib/server/mock/db";
import { bulk, checkRoleGrant, checkUserChange } from "@/lib/server/mock/rules";
import { applyStatus, canonicalRoles, dropTokens, endSessions, statusRule, targetRank } from "@/lib/server/users";
import type { ErrorCode } from "@starterkit/shared/contracts/common";
import { BulkUserBody, MAX_USER_ROLES } from "@starterkit/shared/contracts/users";

/**
 * Bulk activate / deactivate / delete / assignRole. Each id is checked on its own: protected rows (yourself, the last
 * active Superadmin, a user who outranks you, a user who already holds MAX_USER_ROLES roles, unknown ids) are skipped
 * with a code; only `done` ids are applied, and only they reach the activity log. Activate / deactivate use the same
 * rule and activity as PATCH isActive and POST /status.
 */
export async function POST(req: Request): Promise<Response> {
  const body = BulkUserBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, body.success && body.data.action === "delete" ? "user.delete" : "user.edit", async (ctx) => {
    if (!body.success) return handleError(body.error);
    const { action } = body.data;
    const ids = [...new Set(body.data.ids)];
    const role = body.data.role === undefined ? undefined : canonicalRoles([body.data.role])?.[0];
    if (action === "assignRole" && !role) return apiError(400, "bad_request", "This role doesn't exist. Pick a role from the list.");
    const users = db().users;
    const target = [...db().roles.values()].find((r) => r.name === role);
    const grant = target ? checkRoleGrant(ctx.perms, target) : null;
    const rule = (u: UserRecord): ErrorCode | null => {
      if (action === "activate" || action === "deactivate") return statusRule(ctx, u, action === "activate");
      if (action === "delete") return checkUserChange(ctx.user, u, { kind: "delete" }, db());
      if (u.roles.includes(role!)) return checkUserChange(ctx.user, u, { kind: "setRoles", roles: u.roles }, db()) ?? grant;
      if (u.roles.length >= MAX_USER_ROLES) return "bad_request";
      return checkUserChange(ctx.user, u, { kind: "setRoles", roles: [...u.roles, role!] }, db()) ?? grant;
    };
    const result = bulk(ids,
      (id) => { const u = users.get(id); return u ? targetRank(ctx, u) ?? rule(u) : "not_found"; },
      (id) => {
        const u = users.get(id)!;
        if (action === "activate" || action === "deactivate") return applyStatus(ctx, u, action === "activate");
        const target = { type: "user", id, label: u.name };
        if (action === "assignRole") {
          const before = { roles: [...u.roles] };
          if (!u.roles.includes(role!)) u.roles = [...u.roles, role!];
          return recordActivity(ctx, { action: "user.assign_role", target, before, after: { roles: u.roles } });
        }
        const before = toUserDto(u); // the same snapshot DELETE /api/users/[id] records
        users.delete(id); db().ldapDirectory.delete(id); endSessions(id); dropTokens(id);
        recordActivity(ctx, { action: "user.delete", target, before });
      });
    return json(result);
  });
}
