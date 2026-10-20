import type { AuthMethod } from "@starterkit/shared/contracts/auth";
import type { PermissionName } from "@starterkit/shared/permissions";
import { config } from "../config";
import { sql, type Tx } from "../db/client";
import { hashToken, randomToken } from "./crypto";

/** A users row in camelCase (timestamps as ISO strings) with its role names, linked providers and 2FA state. */
export type UserRow = {
  id: string; name: string; username: string; email: string; avatarUrl: string | null; isActive: boolean; isLdap: boolean;
  passwordHash: string | null; totpSecret: string | null; pendingTotpSecret: string | null; totpLastStep: number | null;
  twoFactorEnabled: boolean; roles: string[]; connected: ("google" | "apple")[];
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
};

/** The signed-in user of one request, read fresh from the database. */
export type AuthUser = { user: UserRow; sid: string; perms: Set<PermissionName> };

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** `users.*` plus the `roles` and `connected` arrays, as the driver returns them. */
type UsersRecord = {
  id: string; name: string; username: string; email: string; avatar_url: string | null; is_active: boolean; is_ldap: boolean;
  password_hash: string | null; totp_secret: string | null; pending_totp_secret: string | null; totp_last_step: string | null;
  last_login_at: Date | null; created_at: Date; updated_at: Date; roles: string[]; connected: UserRow["connected"];
};

/** A row of `users.*` plus `roles` and `connected` arrays → UserRow. */
export function toUserRow(r: UsersRecord): UserRow {
  return {
    id: r.id, name: r.name, username: r.username, email: r.email, avatarUrl: r.avatar_url, isActive: r.is_active, isLdap: r.is_ldap,
    passwordHash: r.password_hash, totpSecret: r.totp_secret, pendingTotpSecret: r.pending_totp_secret,
    totpLastStep: r.totp_last_step === null ? null : Number(r.totp_last_step), // bigint arrives as a string
    twoFactorEnabled: r.totp_secret !== null, roles: r.roles, connected: r.connected,
    lastLoginAt: iso(r.last_login_at), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
  };
}

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
  const [r] = await tx`
    insert into sessions (id, token_hash, user_id, method, device, ip, expires_at)
    values (${id}, ${hashToken(token)}, ${o.userId}, ${o.method}, ${deviceOf(o.client.ua)}, ${o.client.ip},
            now() + make_interval(hours => ${config().SESSION_TTL_HOURS}))
    returning expires_at`;
  return { id, token, expiresAt: r.expires_at.toISOString() };
}

/**
 * The user behind a session token, or null: unknown token, the session expired (SESSION_TTL_HOURS) or went idle
 * (SESSION_IDLE_MINUTES; its row is deleted), or the user is inactive. One query reads the session, the user, their
 * roles and the union of the roles' permissions; a live session is marked seen at most once a minute.
 */
export async function resolveSession(token: string): Promise<AuthUser | null> {
  const [r] = await sql`
    select u.*, s.id as sid,
      s.expires_at > now() and s.last_seen_at >= now() - make_interval(mins => ${config().SESSION_IDLE_MINUTES}) as live,
      s.last_seen_at < now() - interval '60 seconds' as stale,
      array(select r.name from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id order by r.name) as roles,
      array(select i.provider from user_identities i where i.user_id = u.id order by i.provider) as connected,
      array(select distinct rp.permission from user_roles ur join role_permissions rp on rp.role_id = ur.role_id where ur.user_id = u.id) as perms
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)}`;
  if (!r) return null;
  if (!r.live) {
    await sql`delete from sessions where id = ${r.sid}`;
    return null;
  }
  if (!r.is_active) return null;
  if (r.stale) await sql`update sessions set last_seen_at = now() where id = ${r.sid} and last_seen_at < now() - interval '60 seconds'`;
  return { user: toUserRow(r), sid: r.sid, perms: new Set(r.perms) };
}

/** Ends one session (sign-out, terminate). */
export async function endSession(id: string): Promise<void> {
  await sql`delete from sessions where id = ${id}`;
}

/** Ends every session of a user, except `exceptSessionId` when given (password change keeps the current one). */
export async function endUserSessions(tx: Tx, userId: string, exceptSessionId?: string): Promise<void> {
  await tx`delete from sessions where user_id = ${userId} ${exceptSessionId ? tx`and id <> ${exceptSessionId}` : tx``}`;
}
