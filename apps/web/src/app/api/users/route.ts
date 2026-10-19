import { randomUUID } from "node:crypto";
import { apiError, handleError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { type UserRecord, db, toUserDto } from "@/lib/server/mock/db";
import { hashPassword } from "@/lib/server/mock/password";
import { duplicateOf, rolesExist, sendInvite } from "@/lib/server/users";
import type { Page } from "@/lib/shared/contracts/common";
import { CreateUserBody, UserListQuery, type UserDto } from "@/lib/shared/contracts/users";

const key = (u: UserRecord, field: string): string => (field === "name" ? u.name : field === "email" ? u.email : field === "lastLoginAt" ? u.lastLoginAt ?? "" : u.createdAt);

export async function GET(req: Request): Promise<Response> {
  const parsed = UserListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const { page, pageSize, q, sort = "name", role, status } = parsed.data;
  return withPermission(req, "user.view", async () => {
    const needle = q?.trim().toLowerCase();
    const rows = [...db().users.values()].filter((u) =>
      (!needle || [u.name, u.username, u.email].some((s) => s.toLowerCase().includes(needle)))
      && (!role || u.roles.includes(role))
      && (!status || u.isActive === (status === "active")));
    const field = sort.replace(/^-/, "");
    const dir = sort.startsWith("-") ? -1 : 1;
    // Empty values (never signed in) sort last in both directions.
    rows.sort((a, b) => {
      const x = key(a, field), y = key(b, field);
      if (x === "" || y === "") return x === y ? 0 : x === "" ? 1 : -1;
      return dir * x.localeCompare(y);
    });
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map(toUserDto);
    return json({ items, total: rows.length, page, pageSize } satisfies Page<UserDto>);
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = CreateUserBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "user.create", async (ctx) => {
    if (!body.success) return apiError(400, "bad_request", "A request parameter has an unsupported value.");
    const b = body.data;
    if (!rolesExist(b.roles)) return apiError(400, "bad_request", "One of the roles doesn't exist. Pick roles from the list.");
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
