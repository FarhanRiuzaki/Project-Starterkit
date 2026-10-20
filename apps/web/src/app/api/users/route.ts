import { randomUUID } from "node:crypto";
import { apiError, badRequest, handleError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { type UserRecord, db, toUserDto } from "@/lib/server/mock/db";
import { hashPassword } from "@/lib/server/mock/password";
import { canonicalRoles, duplicateOf, roleGrantDenied, sendInvite, unknownRole, userPage } from "@/lib/server/users";
import { CreateUserBody, UserListQuery } from "@starterkit/shared/contracts/users";

export async function GET(req: Request): Promise<Response> {
  const parsed = UserListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  return withPermission(req, "user.view", async () => json(userPage(parsed.data)));
}

export async function POST(req: Request): Promise<Response> {
  const body = CreateUserBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "user.create", async (ctx) => {
    if (!body.success) return badRequest();
    const b = body.data;
    const roles = canonicalRoles(b.roles);
    if (!roles) return unknownRole();
    const denied = roleGrantDenied(ctx.perms, roles);
    if (denied) return denied;
    if (duplicateOf(b.username, b.email)) return apiError(409, "duplicate", "Another user already has this username or email. Use different ones.");
    const id = `u-${randomUUID()}`;
    const rec: UserRecord = {
      id, name: b.name, username: b.username, email: b.email, avatarUrl: null, isActive: b.isActive, isLdap: b.isLdap, twoFactorEnabled: false,
      roles, connected: [], lastLoginAt: null, createdAt: new Date().toISOString(),
      passwordHash: b.password ? hashPassword(b.password) : null, totpSecret: null, recoveryCodes: [],
    };
    db().users.set(id, rec);
    if (b.invite) sendInvite(rec);
    const dto = toUserDto(rec);
    recordActivity(ctx, { action: "user.create", target: { type: "user", id, label: rec.name }, after: { ...dto, invited: !!b.invite } });
    return json(dto, 201);
  });
}
