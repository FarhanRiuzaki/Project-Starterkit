import { apiError, handleError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db, type UserRecord } from "@/lib/server/mock/db";
import { bulk, checkRoleGrant, checkUserChange } from "@/lib/server/mock/rules";
import { dropTokens, endSessions, rolesExist, targetRank } from "@/lib/server/users";
import { BulkUserBody } from "@/lib/shared/contracts/users";

/**
 * Bulk activate / deactivate / delete / assignRole. Each id is checked on its own: protected rows (yourself, the last
 * active Superadmin, a user who outranks you, unknown ids) are skipped with a code; only `done` ids are applied, and only they reach the activity log.
 */
export async function POST(req: Request): Promise<Response> {
  const body = BulkUserBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, body.success && body.data.action === "delete" ? "user.delete" : "user.edit", async (ctx) => {
    if (!body.success) return handleError(body.error);
    const { action, role } = body.data;
    const ids = [...new Set(body.data.ids)];
    if (action === "assignRole" && !rolesExist([role!])) return apiError(400, "bad_request", "This role doesn't exist. Pick a role from the list.");
    const users = db().users;
    const target = [...db().roles.values()].find((r) => r.name === role);
    const grant = target ? checkRoleGrant(ctx.perms, target) : null;
    const withUser = (id: string, f: (u: UserRecord) => ReturnType<typeof checkUserChange>) => { const u = users.get(id); return u ? f(u) : "not_found" as const; };
    const result = bulk(ids,
      (id) => withUser(id, (u) => targetRank(ctx, u) ?? (
        action === "deactivate" ? checkUserChange(ctx.user, u, { kind: "deactivate" }, db())
          : action === "delete" ? checkUserChange(ctx.user, u, { kind: "delete" }, db())
          : action === "assignRole" ? checkUserChange(ctx.user, u, { kind: "setRoles", roles: [...u.roles, role!] }, db()) ?? grant
          : null)),
      (id) => {
        const u = users.get(id)!;
        const before = { isActive: u.isActive, roles: [...u.roles] };
        if (action === "activate") u.isActive = true;
        else if (action === "deactivate") { u.isActive = false; endSessions(id); }
        else if (action === "assignRole") { if (!u.roles.includes(role!)) u.roles = [...u.roles, role!]; }
        else { users.delete(id); db().ldapDirectory.delete(id); endSessions(id); dropTokens(id); }
        recordActivity(ctx, {
          action: action === "assignRole" ? "user.assign_role" : `user.${action}`, target: { type: "user", id, label: u.name }, before,
          after: action === "delete" ? null : { isActive: u.isActive, roles: u.roles },
        });
      });
    return json(result);
  });
}
