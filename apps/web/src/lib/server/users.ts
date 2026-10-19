import { randomBytes, randomInt } from "node:crypto";
import { apiError } from "./api";
import { log } from "./logger";
import { db, type SessionRecord, toUserDto, type UserRecord } from "./mock/db";
import { hashToken } from "./mock/password";
import { checkRoleGrant, effectivePermissions } from "./mock/rules";
import { paginate, type Sorters } from "./paginate";
import type { AuthCtx } from "./session";
import type { Page } from "@/lib/shared/contracts/common";
import type { SessionDto, SessionListQuery } from "@/lib/shared/contracts/me";
import type { RoleOption, RoleOptionQuery } from "@/lib/shared/contracts/rbac";
import type { UserDetailDto, UserDto, UserListQuery } from "@/lib/shared/contracts/users";
import type { PermissionName } from "@/lib/shared/permissions";

const INVITE_TTL_MS = 72 * 3600_000;

/** Another user (not `exceptId`) that already has this username or email, compared case-insensitively. */
export function duplicateOf(username: string | undefined, email: string | undefined, exceptId?: string): UserRecord | undefined {
  const u = username?.toLowerCase();
  const e = email?.toLowerCase();
  return [...db().users.values()].find((o) => o.id !== exceptId && ((u && o.username.toLowerCase() === u) || (e && o.email.toLowerCase() === e)));
}

/** First role among `names` (existing roles only) the actor may not grant or remove, as a 403; else null. */
export function roleGrantDenied(actorPerms: ReadonlySet<PermissionName>, names: readonly string[]): Response | null {
  for (const r of db().roles.values()) {
    if (names.includes(r.name) && checkRoleGrant(actorPerms, r)) return apiError(403, "forbidden", `Your role doesn't allow granting or removing ${r.name}. Ask an administrator who has all its permissions.`);
  }
  return null;
}

/** Every name in `roles` is an existing role. */
export const rolesExist = (roles: readonly string[]): boolean => {
  const names = new Set([...db().roles.values()].map((r) => r.name));
  return roles.every((r) => names.has(r));
};

// Read functions: one per resource, called by its GET route and by the page's server prefetch (lib/server/prefetch.tsx)
// after the same permission check, so both answer the same data.

/** Never signed in = no value (sorts last both ways). */
const USER_SORTERS: Sorters<UserRecord> = {
  name: (u) => u.name, email: (u) => u.email, lastLoginAt: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : null), createdAt: (u) => Date.parse(u.createdAt),
};

/** One page of users (GET /api/users): `q` matches name, username or email; `role` and `status` are exact. */
export function userPage(query: UserListQuery): Page<UserDto> {
  const { q, role, status } = query;
  const needle = q?.trim().toLowerCase();
  const rows = [...db().users.values()].filter((u) =>
    (!needle || [u.name, u.username, u.email].some((s) => s.toLowerCase().includes(needle)))
    && (!role || u.roles.includes(role))
    && (!status || u.isActive === (status === "active")));
  const page = paginate(rows, query, USER_SORTERS, "name");
  return { ...page, items: page.items.map(toUserDto) };
}

/** Role options for pickers (GET /api/users/roles): one page of { id, name }, name A–Z; `q` matches the name. */
export function roleOptionPage(q: RoleOptionQuery): Page<RoleOption> {
  const needle = q.q?.trim().toLowerCase();
  const rows: RoleOption[] = [...db().roles.values()].filter((r) => !needle || r.name.toLowerCase().includes(needle)).map((r) => ({ id: r.id, name: r.name }));
  return paginate(rows, q, { name: (r) => r.name }, "name");
}

/** One user with effective permissions (GET /api/users/[id]); recent activity only with audit.view. Null = no such user. */
export function userDetail(id: string, ctx: AuthCtx): UserDetailDto | null {
  const u = db().users.get(id);
  if (!u) return null;
  // Audit history needs audit.view; the entries carry no before/after snapshots.
  const recentActivity = ctx.perms.has("audit.view")
    ? [...db().activity.values()].filter((a) => a.target.id === id)
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20)
      .map((a) => ({ id: a.id, at: a.at, actor: { name: a.actor.name }, action: a.action }))
    : null;
  return { ...toUserDto(u), permissions: [...effectivePermissions(u, db().roles)], recentActivity };
}

/** One page of a user's sessions (GET /api/me/sessions, GET /api/users/[id]/sessions), newest activity first by default; `currentSid` is marked. */
export function sessionPage(userId: string, q: SessionListQuery, currentSid: string): Page<SessionDto> {
  const page = paginate(sessionsOf(userId), q, SESSION_SORTERS, "-lastSeenAt");
  return { ...page, items: page.items.map((s) => toSessionDto(s, currentSid)) };
}

/** Store sessions of one user (unsorted); GET /api/me/sessions and GET /api/users/[id]/sessions page them. */
export const sessionsOf = (userId: string): SessionRecord[] => [...db().sessions.values()].filter((s) => s.userId === userId);
export const SESSION_SORTERS: Sorters<SessionRecord> = { lastSeenAt: (s) => Date.parse(s.lastSeenAt), device: (s) => s.device };
/** `current` = the session making this request. */
export const toSessionDto = (s: SessionRecord, currentSid: string): SessionDto => ({ id: s.id, device: s.device, ip: s.ip, lastSeenAt: s.lastSeenAt, current: s.id === currentSid });

/** Sign the user out everywhere (deactivate, delete, password reset). */
export function endSessions(userId: string): void {
  for (const [id, s] of db().sessions) if (s.userId === userId) db().sessions.delete(id);
}

/** Set-password link for a new user: same store and hashing as forgot-password, valid 72 hours; the link goes to the log (mock email). */
export function sendInvite(user: UserRecord): void {
  const tokens = db().resetTokens;
  const now = Date.now();
  for (const [k, t] of tokens) if (t.expiresAt <= now || t.userId === user.id) tokens.delete(k);
  const token = randomBytes(32).toString("base64url");
  tokens.set(hashToken(token), { userId: user.id, expiresAt: now + INVITE_TTL_MS });
  log.info({ userId: user.id, link: `/reset-password?token=${token}` }, "mock email: invitation link");
}

/** 18 random chars from an alphabet without look-alikes, plus one of each class so any password rule passes; unbiased (randomInt) and shuffled. */
export function temporaryPassword(): string {
  const pick = (set: string) => set[randomInt(set.length)]!;
  const all = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = [pick("abcdefghijkmnpqrstuvwxyz"), pick("ABCDEFGHJKLMNPQRSTUVWXYZ"), pick("23456789"), pick("-_!#"), ...Array.from({ length: 14 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}

/** Spent reset / invite links of a user (delete, admin reset). */
export function dropTokens(userId: string): void {
  for (const [k, t] of db().resetTokens) if (t.userId === userId) db().resetTokens.delete(k);
}
