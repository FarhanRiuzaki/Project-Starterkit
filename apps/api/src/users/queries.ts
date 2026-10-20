import type { SQL } from "bun";
import type { Page } from "@starterkit/shared/contracts/common";
import type { SessionDto, SessionListQuery } from "@starterkit/shared/contracts/me";
import { type ActivityBrief, UserDto, type UserListQuery, type UserRowDto } from "@starterkit/shared/contracts/users";
import type { PermissionName } from "@starterkit/shared/permissions";
import { permsOf, sessionLive, toUserRow } from "../db/fragments";
import { sql, type Tx } from "../db/client";
import { type Fragment, likeEscape, pageQuery, sortSql } from "../db/page";
import { LOCKS } from "../kernel/locks";
import { inCatalogOrder } from "../rbac/rules";
import { SUPERADMIN } from "./rules";

type UserRecord = Parameters<typeof toUserRow>[0] & { perms: PermissionName[] };

// users.* with role names (A–Z), linked providers and effective permissions: sub-selects in the one query, never a
// query per row.
const USER_SELECT = sql`u.*,
  array(select r.name from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id order by r.name) as roles,
  array(select i.provider from user_identities i where i.user_id = u.id order by i.provider) as connected,
  ${permsOf(sql`u.id`)} as perms`;

/** A user with their effective permissions, in catalog order. */
const toRow = (r: UserRecord): UserRowDto => ({ ...UserDto.parse(toUserRow(r)), permissions: inCatalogOrder(r.perms) });

// Never signed in = no value, last both ways (as the mock's sorter). Migration 0002 indexes these expressions.
const USER_SORTS = {
  name: "lower(u.name)", email: "lower(u.email)", lastLoginAt: "u.last_login_at is null, u.last_login_at", createdAt: "u.created_at",
};

/**
 * One page of users (GET /v1/users): `q` matches name, username or email; `role` (any letter case) and `status` are
 * exact. The page is paged by id first, then one query reads those rows: on an index-ordered scan PostgreSQL would
 * run the sub-selects for every row the OFFSET skips (497 ms for page 1000 × 100 on 100k users).
 */
export async function userPage(q: UserListQuery): Promise<Page<UserRowDto>> {
  const needle = q.q?.trim();
  const like = `%${likeEscape(needle ?? "")}%`;
  const page = await pageQuery<{ id: string }, string>({
    select: sql`u.id`,
    from: sql`from users u
      where ${needle ? sql`(u.name ilike ${like} or u.username ilike ${like} or u.email ilike ${like})` : sql`true`}
      and ${q.role ? sql`exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id and lower(r.name) = lower(${q.role}))` : sql`true`}
      and ${q.status ? sql`u.is_active = ${q.status === "active"}` : sql`true`}`,
    orderBy: sortSql(q.sort, USER_SORTS, "name"),
    query: q,
    map: (r) => r.id,
  });
  const rows = new Map((await usersByIds(sql, page.items)).map((u) => [u.id, u]));
  return { ...page, items: page.items.flatMap((id) => rows.get(id) ?? []) }; // a user deleted in between drops out
}

/** The users among `ids` (UUIDs), read through `db` (a transaction sees its own changes). */
export async function usersByIds(db: SQL, ids: string[]): Promise<UserRowDto[]> {
  if (!ids.length) return [];
  return (await db<UserRecord[]>`select ${USER_SELECT} from users u where u.id in ${db(ids)}`).map(toRow);
}

/**
 * Locks the rows of `ids` for the transaction (in id order, so two bulk requests never deadlock), then reads them:
 * after the lock, so a change committed meanwhile is seen.
 */
export async function lockUsers(tx: Tx, ids: string[]): Promise<Map<string, UserRowDto>> {
  if (ids.length) await tx`select id from users where id in ${tx(ids)} order by id for update`;
  return new Map((await usersByIds(tx, ids)).map((u) => [u.id, u]));
}

/** The last 20 activity entries targeting `userId`, newest first, without target or snapshots. */
export async function recentActivity(userId: string): Promise<ActivityBrief[]> {
  const rows: { id: string; at: Date; actor_name: string; action: string }[] =
    await sql`select id, at, actor_name, action from activity where target_id = ${userId} order by at desc, id desc limit 20`;
  return rows.map((a) => ({ id: a.id, at: a.at.toISOString(), actor: { name: a.actor_name }, action: a.action }));
}

export type RoleRef = { id: string; name: string; permissions: PermissionName[] };

/**
 * Roles matching `where` (alias `r`) with their permissions. The rows are share-locked first, in a statement of their
 * own: a role edit or delete in progress finishes before the read (a deleted role is then simply missing), and none
 * starts until this transaction ends. Role routes never wait on user rows or SUPERADMIN_LOCK, so this can't deadlock.
 */
async function lockedRoles(tx: Tx, where: Fragment): Promise<RoleRef[]> {
  await tx`select 1 from roles r where ${where} for share`;
  return tx`select r.id, r.name, array(select rp.permission from role_permissions rp where rp.role_id = r.id) as permissions
    from roles r where ${where} order by r.name`;
}

/** Roles named in `names` (any letter case), share-locked, keyed by lower-case name. */
export async function rolesByName(tx: Tx, names: readonly string[]): Promise<Map<string, RoleRef>> {
  if (!names.length) return new Map();
  const rows = await lockedRoles(tx, sql`lower(r.name) in ${tx([...new Set(names.map((n) => n.toLowerCase()))])}`);
  return new Map(rows.map((r) => [r.name.toLowerCase(), r]));
}

/** The roles `userId` holds now, by id (a rename since the user was read doesn't matter), share-locked, A–Z. */
export const rolesOfUser = (tx: Tx, userId: string): Promise<RoleRef[]> =>
  lockedRoles(tx, sql`r.id in (select role_id from user_roles where user_id = ${userId})`);

/** pg_advisory_xact_lock key for changes that can lower the number of active Superadmins. */
export const SUPERADMIN_LOCK = LOCKS.superadmin;

/**
 * Active Superadmins other than `userId`, counted after taking SUPERADMIN_LOCK: two changes that could each remove
 * one of the last two run one after the other, and the second sees the first.
 */
export async function otherSuperadmins(tx: Tx, userId: string): Promise<number> {
  await tx`select pg_advisory_xact_lock(${SUPERADMIN_LOCK})`;
  const [{ n }] = await tx`select count(*)::int as n from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
    where r.name = ${SUPERADMIN} and u.is_active and u.id <> ${userId}`;
  return n;
}

/** Another user (not `exceptId`) that already has this username or email, any letter case. */
export async function duplicateOf(tx: Tx, username: string | undefined, email: string | undefined, exceptId: string): Promise<boolean> {
  return (await tx`select 1 from users where id <> ${exceptId}
    and (lower(username) = lower(${username ?? null}) or lower(email) = lower(${email ?? null})) limit 1`).length > 0;
}

const SESSION_SORTS = { lastSeenAt: "s.last_seen_at", device: "lower(s.device)" };

/**
 * One page of a user's live sessions (GET /v1/users/{id}/sessions; /v1/me/sessions too), newest activity first by
 * default; `currentSid` is marked. Ended sessions are left out, as the mock's prune-then-list.
 */
export const sessionPage = (userId: string, q: SessionListQuery, currentSid: string): Promise<Page<SessionDto>> =>
  pageQuery<{ id: string; device: string; ip: string; last_seen_at: Date }, SessionDto>({
    select: sql`s.id, s.device, s.ip, s.last_seen_at`,
    from: sql`from sessions s where s.user_id = ${userId} and ${sessionLive()}`,
    orderBy: sortSql(q.sort, SESSION_SORTS, "-lastSeenAt"),
    query: q,
    map: (s) => ({ id: s.id, device: s.device, ip: s.ip, lastSeenAt: s.last_seen_at.toISOString(), current: s.id === currentSid }),
  });
