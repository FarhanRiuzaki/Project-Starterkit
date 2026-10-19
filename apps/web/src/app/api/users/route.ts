import { randomUUID } from "node:crypto";
import { apiError, badRequest, handleError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { type UserRecord, db, toUserDto } from "@/lib/server/mock/db";
import { hashPassword } from "@/lib/server/mock/password";
import { paginate, type Sorters } from "@/lib/server/paginate";
import { duplicateOf, roleGrantDenied, rolesExist, sendInvite } from "@/lib/server/users";
import { CreateUserBody, UserListQuery } from "@/lib/shared/contracts/users";

/** Never signed in = no value (sorts last both ways). */
const USER_SORTERS: Sorters<UserRecord> = {
  name: (u) => u.name, email: (u) => u.email, lastLoginAt: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : null), createdAt: (u) => Date.parse(u.createdAt),
};

export async function GET(req: Request): Promise<Response> {
  const parsed = UserListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const query = parsed.data;
  const { q, role, status } = query;
  return withPermission(req, "user.view", async () => {
    const needle = q?.trim().toLowerCase();
    const rows = [...db().users.values()].filter((u) =>
      (!needle || [u.name, u.username, u.email].some((s) => s.toLowerCase().includes(needle)))
      && (!role || u.roles.includes(role))
      && (!status || u.isActive === (status === "active")));
    const page = paginate(rows, query, USER_SORTERS, "name");
    return json({ ...page, items: page.items.map(toUserDto) });
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = CreateUserBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "user.create", async (ctx) => {
    if (!body.success) return badRequest();
    const b = body.data;
    if (!rolesExist(b.roles)) return apiError(400, "bad_request", "One of the roles doesn't exist. Pick roles from the list.");
    const denied = roleGrantDenied(ctx.perms, b.roles);
    if (denied) return denied;
    if (duplicateOf(b.username, b.email)) return apiError(409, "duplicate", "Another user already has this username or email. Use different ones.");
    const id = `u-${randomUUID()}`;
    const rec: UserRecord = {
      id, name: b.name, username: b.username, email: b.email, avatarUrl: null, isActive: b.isActive, isLdap: b.isLdap, twoFactorEnabled: false,
      roles: [...new Set(b.roles)], connected: [], lastLoginAt: null, createdAt: new Date().toISOString(),
      passwordHash: b.password ? hashPassword(b.password) : null, totpSecret: null, recoveryCodes: [],
    };
    db().users.set(id, rec);
    if (b.invite) sendInvite(rec);
    const dto = toUserDto(rec);
    recordActivity(ctx, { action: "user.create", target: { type: "user", id, label: rec.name }, after: { ...dto, invited: !!b.invite } });
    return json(dto, 201);
  });
}
