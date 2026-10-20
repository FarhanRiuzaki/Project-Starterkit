// Transitional: raw-SQL fragments of the session queries for the Hono routes until Tasks 16–17; the Drizzle versions
// (and everything else about sessions) live in modules/auth.
import type { UserRow } from "../modules/auth";
import { sql } from "../db/client";
import { config } from "../kernel/config";

/** `users.*` plus the `roles` and `connected` arrays, as the driver returns them. */
type UsersRecord = {
  id: string; name: string; username: string; email: string; avatar_url: string | null; is_active: boolean; is_ldap: boolean;
  password_hash: string | null; totp_secret: string | null; pending_totp_secret: string | null; totp_last_step: string | null;
  last_login_at: Date | null; created_at: Date; updated_at: Date; roles: string[]; connected: UserRow["connected"];
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** A raw row of `users.*` plus `roles` and `connected` arrays → UserRow. */
export function toUserRow(r: UsersRecord): UserRow {
  return {
    id: r.id, name: r.name, username: r.username, email: r.email, avatarUrl: r.avatar_url, isActive: r.is_active, isLdap: r.is_ldap,
    passwordHash: r.password_hash, totpSecret: r.totp_secret, pendingTotpSecret: r.pending_totp_secret,
    totpLastStep: r.totp_last_step === null ? null : Number(r.totp_last_step), // bigint arrives as a string
    twoFactorEnabled: r.totp_secret !== null, roles: r.roles, connected: r.connected,
    lastLoginAt: iso(r.last_login_at), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
  };
}

/** SQL for the union of the permissions of a user's roles (`userId`: a value or a column fragment). */
export const permsOf = (userId: unknown) =>
  sql`array(select distinct rp.permission from user_roles ur join role_permissions rp on rp.role_id = ur.role_id where ur.user_id = ${userId})`;

/** SQL: session `s` has not ended (SESSION_TTL_HOURS since sign-in, SESSION_IDLE_MINUTES since its last request). */
export const sessionLive = () =>
  sql`s.expires_at > now() and s.last_seen_at >= now() - make_interval(mins => ${config().SESSION_IDLE_MINUTES})`;
