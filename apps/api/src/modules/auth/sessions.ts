import { and, eq, getTableColumns, gt, gte, lt, ne, type SQL, sql, type SQLWrapper } from "drizzle-orm";
import type { AuthMethod } from "@starterkit/shared/contracts/auth";
import type { Page } from "@starterkit/shared/contracts/common";
import type { SessionDto, SessionListQuery } from "@starterkit/shared/contracts/me";
import type { PermissionName } from "@starterkit/shared/permissions";
import { config } from "../../kernel/config";
import { hashToken, randomToken } from "../../kernel/crypto";
import { db, type Tx } from "../../kernel/db";
import { one, pageQuery, sortSql } from "../../kernel/pagination";
import { rolePermissions, roles, userRoles } from "../rbac";
import { users } from "../users";
import { sessions } from "./schema";

/** A users row (timestamps as ISO strings) with its role names, linked providers and 2FA state. */
export type UserRow = {
  id: string; name: string; username: string; email: string; avatarUrl: string | null; isActive: boolean; isLdap: boolean;
  passwordHash: string | null; totpSecret: string | null; pendingTotpSecret: string | null; totpLastStep: number | null;
  twoFactorEnabled: boolean; roles: string[]; connected: ("google" | "apple")[];
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
};

/** The signed-in user of one request, read fresh from the database. */
export type AuthUser = { user: UserRow; sid: string; perms: Set<PermissionName> };

/** A `users` row plus its `roles` and `connected` arrays → UserRow. */
export function toUserRow(r: typeof users.$inferSelect & { roles: string[]; connected: UserRow["connected"] }): UserRow {
  return {
    id: r.id, name: r.name, username: r.username, email: r.email, avatarUrl: r.avatarUrl, isActive: r.isActive, isLdap: r.isLdap,
    passwordHash: r.passwordHash, totpSecret: r.totpSecret, pendingTotpSecret: r.pendingTotpSecret, totpLastStep: r.totpLastStep,
    twoFactorEnabled: r.totpSecret !== null, roles: r.roles, connected: r.connected,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

/** SQL: the role names of user `userId` (a value or a column), A–Z. */
export const rolesOf = (userId: string | SQLWrapper) =>
  sql<string[]>`array(${db.select({ name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId)).orderBy(roles.name)})`;

/** SQL: the providers linked to user `userId`, A–Z. */
export async function providersOf(userId: string | SQLWrapper): Promise<SQL<UserRow["connected"]>> {
  // Loaded on first use, not imported: oauth (the owner of user_identities) imports this module's index.
  const { userIdentities } = await import("../oauth");
  return sql`array(${db.select({ p: userIdentities.provider }).from(userIdentities).where(eq(userIdentities.userId, userId)).orderBy(userIdentities.provider)})`;
}

/** SQL: the union of the permissions of a user's roles; one expression for sessions and user lists. */
export const permsOf = (userId: string | SQLWrapper) =>
  sql<PermissionName[]>`array(${db.selectDistinct({ p: rolePermissions.permission }).from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId)).where(eq(userRoles.userId, userId))})`;

/** "Chrome on macOS" from a User-Agent; "Unknown device" when neither part is known. */
export function deviceOf(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return browser && os ? `${browser} on ${os}` : browser ?? os ?? "Unknown device";
}

/** A new session (sign-in) lasting SESSION_TTL_HOURS at most. The token goes to the client; only its hash is stored. */
export async function createSession(
  tx: Tx,
  o: { userId: string; method: AuthMethod; client: { ip: string; ua: string } },
): Promise<{ id: string; token: string; expiresAt: string }> {
  const id = Bun.randomUUIDv7();
  const token = randomToken();
  const [r] = await tx.insert(sessions).values({
    id, tokenHash: hashToken(token), userId: o.userId, method: o.method, device: deviceOf(o.client.ua), ip: o.client.ip,
    expiresAt: sql`now() + make_interval(hours => ${config().SESSION_TTL_HOURS})`,
  }).returning({ expiresAt: sessions.expiresAt });
  return { id, token, expiresAt: r!.expiresAt.toISOString() };
}

/** The user's permissions right now, read through `tx` (a transaction sees its own locks): escalation checks use this, not the request's earlier `ctx.perms`. */
export async function actorPermissions(tx: Tx, userId: string): Promise<Set<PermissionName>> {
  const rows = await tx.selectDistinct({ p: rolePermissions.permission }).from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId)).where(eq(userRoles.userId, userId));
  return new Set(rows.map((r) => r.p as PermissionName));
}

/** SQL: a `sessions` row has not ended (SESSION_TTL_HOURS since sign-in, SESSION_IDLE_MINUTES since its last request). */
export const sessionLive = (): SQL =>
  and(gt(sessions.expiresAt, sql`now()`), gte(sessions.lastSeenAt, sql`now() - make_interval(mins => ${config().SESSION_IDLE_MINUTES})`))!;

const MINUTE_AGO = sql`now() - interval '60 seconds'`;

/**
 * The user behind a session token, or null: unknown token, the session expired (SESSION_TTL_HOURS) or went idle
 * (SESSION_IDLE_MINUTES; its row is deleted), or the user is inactive. One query reads the session, the user, their
 * roles and the union of the roles' permissions; a live session is marked seen at most once a minute.
 */
export async function resolveSession(token: string): Promise<AuthUser | null> {
  const [r] = await db.select({
    ...getTableColumns(users),
    sid: sessions.id,
    live: sql<boolean>`${sessionLive()}`,
    stale: sql<boolean>`${sessions.lastSeenAt} < ${MINUTE_AGO}`,
    roles: rolesOf(users.id),
    connected: await providersOf(users.id),
    perms: permsOf(users.id),
  }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.tokenHash, hashToken(token)));
  if (!r) return null;
  if (!r.live) {
    await db.delete(sessions).where(eq(sessions.id, r.sid));
    return null;
  }
  if (!r.isActive) return null;
  if (r.stale) await db.update(sessions).set({ lastSeenAt: sql`now()` }).where(and(eq(sessions.id, r.sid), lt(sessions.lastSeenAt, MINUTE_AGO)));
  return { user: toUserRow(r), sid: r.sid, perms: new Set(r.perms) };
}

/** Ends one session (sign-out, terminate), through `tx` when given. */
export async function endSession(id: string, tx: Tx = db): Promise<void> {
  await tx.delete(sessions).where(eq(sessions.id, id));
}

/** Ends every session of a user, except `exceptSessionId` when given (password change keeps the current one). */
export async function endUserSessions(tx: Tx, userId: string, exceptSessionId?: string): Promise<void> {
  await tx.delete(sessions).where(and(eq(sessions.userId, userId), exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined));
}

/** Session `id` is `userId`'s and has not ended. */
export async function isLiveSession(id: string, userId: string): Promise<boolean> {
  const rows = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId), sessionLive()));
  return rows.length === 1;
}

/** Locks session `id` for the transaction when it is `userId`'s and has not ended; its device, else undefined. */
export async function lockLiveSession(tx: Tx, userId: string, id: string): Promise<{ device: string } | undefined> {
  const [s] = await tx.select({ device: sessions.device }).from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId), sessionLive())).for("update");
  return s;
}

const SESSION_SORTS = { lastSeenAt: sessions.lastSeenAt, device: sql`lower(${sessions.device})` };

/**
 * One page of a user's live sessions (GET /v1/me/sessions), newest activity first by default; `currentSid` is
 * marked. Ended sessions are left out, as the mock's prune-then-list.
 */
export function sessionPage(userId: string, q: SessionListQuery, currentSid: string): Promise<Page<SessionDto>> {
  const where = and(eq(sessions.userId, userId), sessionLive());
  return pageQuery({
    rows: db.select({ id: sessions.id, device: sessions.device, ip: sessions.ip, lastSeenAt: sessions.lastSeenAt }).from(sessions).where(where).$dynamic(),
    count: db.select(one).from(sessions).where(where).$dynamic(),
    orderBy: sortSql(q.sort, SESSION_SORTS, "-lastSeenAt", sessions.id),
    query: q,
    map: (s) => ({ id: s.id, device: s.device, ip: s.ip, lastSeenAt: s.lastSeenAt.toISOString(), current: s.id === currentSid }),
  });
}
