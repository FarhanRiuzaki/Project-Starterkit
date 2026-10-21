// The /v1/users* logic, and the writes on users and recovery_codes that other modules make (auth: sign-in, 2FA step,
// reset; me: own profile, password and 2FA; each one statement, or one transaction step of the caller's `tx`).
// Every check that compares the actor with another user runs inside the transaction: the target rows are locked first
// (id order), then the roles the request names are share-locked (bulk share-locks its one role before the rows), then
// the actor's permissions are read (never the request's earlier ctx.perms), and last the Superadmin count takes its
// advisory lock.
import {
  and, asc, desc, eq, exists, getTableColumns, ilike, inArray, isNotNull, isNull, lt, ne, or, sql, type SQLWrapper,
} from "drizzle-orm";
import type { BulkResult, ErrorCode, Page } from "@starterkit/shared/contracts/common";
import {
  type ActivityBrief, BULK_ALL_MAX, type BulkUserBody, type BulkUserFilter, type CreateUserBody, MAX_USER_ROLES, type UpdateUserBody, UserDto, type UserDetailDto, type UserListQuery,
  type UserRowDto,
} from "@starterkit/shared/contracts/users";
import type { PermissionName } from "@starterkit/shared/permissions";
import { config } from "../../kernel/config";
import { randomToken } from "../../kernel/crypto";
import { db, type InTx, type Tx } from "../../kernel/db";
import { ApiError, currentSession, isUniqueViolation, notFound } from "../../kernel/errors";
import { xactLock } from "../../kernel/locks";
import { sendMail } from "../../kernel/mailer";
import { likeEscape, one, pageQuery, sortSql } from "../../kernel/pagination";
import { isUuid } from "../../kernel/parse";
import { activity, recordActivity } from "../audit";
import {
  actorPermissions, createInvite, type Ctx, deleteUserTokens, endSession, endUserSessions, hashPassword, permsOf, providersOf, rolesOf, sessionLive,
  sessions, toUserRow,
} from "../auth";
import { checkRoleGrant, grantRoles, inCatalogOrder, type RoleRef, revokeRoles, roles, rolesByName, rolesOfUser, userRoles } from "../rbac";
import { bulk, canonical, checkPasswordOp, checkTargetRank, checkUserChange, SUPERADMIN, temporaryPassword, type UserChange } from "./rules";
import { recoveryCodes, users } from "./schema";

const NOW = sql`now()`;

/** Locks the user's row for the transaction, then reads what a self-service change decides on. */
export async function lockUser(tx: Tx, id: string): Promise<{ name: string; email: string; hasPassword: boolean } | undefined> {
  const [u] = await tx.select({ name: users.name, email: users.email, hasPassword: sql<boolean>`${users.passwordHash} is not null` })
    .from(users).where(eq(users.id, id)).for("update");
  return u;
}

/** Another user (not `exceptId`) that already has this username or email, any letter case. */
export async function duplicateOf(tx: Tx, username: string | undefined, email: string | undefined, exceptId: string): Promise<boolean> {
  const same = (col: SQLWrapper, v: string | undefined) => eq(sql`lower(${col})`, sql`lower(${v ?? null})`);
  const rows = await tx.select({ one: sql`1` }).from(users)
    .where(and(ne(users.id, exceptId), or(same(users.username, username), same(users.email, email)))).limit(1);
  return rows.length > 0;
}

/** Name, username, email, password hash and/or status, and `updated_at` stamped. */
export async function updateUser(
  tx: Tx, id: string, v: { name?: string; username?: string; email?: string; passwordHash?: string; isActive?: boolean },
): Promise<void> {
  await tx.update(users).set({ ...v, updatedAt: NOW }).where(eq(users.id, id));
}

/** The password hash and nothing else (a reset or invitation link). */
export async function setPassword(tx: Tx, id: string, hash: string): Promise<void> {
  await tx.update(users).set({ passwordHash: hash }).where(eq(users.id, id));
}

/** `last_login_at` = now (a full sign-in). */
export async function stampSignIn(tx: Tx, id: string): Promise<void> {
  await tx.update(users).set({ lastLoginAt: NOW }).where(eq(users.id, id));
}

/** TOTP replay guard: records `step` only when it is newer than the last accepted one; true when it did. */
export async function advanceTotpStep(id: string, step: number): Promise<boolean> {
  const done = await db.update(users).set({ totpLastStep: step })
    .where(and(eq(users.id, id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step)))).returning({ id: users.id });
  return done.length === 1;
}

/** The user's unused recovery codes (hashes). */
export const unusedRecoveryCodes = (userId: string): Promise<{ id: string; codeHash: string }[]> =>
  db.select({ id: recoveryCodes.id, codeHash: recoveryCodes.codeHash }).from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));

/** Marks one recovery code used; `used_at is null` again, so of two concurrent uses only one is true. */
export async function markRecoveryCodeUsed(id: string): Promise<boolean> {
  const done = await db.update(recoveryCodes).set({ usedAt: NOW })
    .where(and(eq(recoveryCodes.id, id), isNull(recoveryCodes.usedAt))).returning({ id: recoveryCodes.id });
  return done.length === 1;
}

/** Stores a new pending (encrypted) TOTP secret while 2FA is off; false when it is on. */
export async function startTotp(tx: Tx, id: string, encrypted: string): Promise<boolean> {
  const done = await tx.update(users).set({ pendingTotpSecret: encrypted, updatedAt: NOW })
    .where(and(eq(users.id, id), isNull(users.totpSecret))).returning({ id: users.id });
  return done.length === 1;
}

/**
 * Turns 2FA on with the pending secret the code matched (still `pending`: a second setup in between would have
 * replaced it), the code's step as the replay guard, and these recovery code hashes in place of any old ones; false
 * (nothing written) when the pending secret changed or 2FA is already on.
 */
export async function enableTotp(tx: Tx, id: string, o: { pending: string; step: number; codeHashes: string[] }): Promise<boolean> {
  const done = await tx.update(users).set({ totpSecret: sql`${users.pendingTotpSecret}`, pendingTotpSecret: null, totpLastStep: o.step, updatedAt: NOW })
    .where(and(eq(users.id, id), eq(users.pendingTotpSecret, o.pending), isNull(users.totpSecret))).returning({ id: users.id });
  if (!done.length) return false;
  await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, id));
  await tx.insert(recoveryCodes).values(o.codeHashes.map((codeHash) => ({ id: Bun.randomUUIDv7(), userId: id, codeHash })));
  return true;
}

/** Turns 2FA off: both secrets and the recovery codes go; false when it was already off. */
export async function disableTotp(tx: Tx, id: string): Promise<boolean> {
  const done = await tx.update(users).set({ totpSecret: null, pendingTotpSecret: null, updatedAt: NOW })
    .where(and(eq(users.id, id), isNotNull(users.totpSecret))).returning({ id: users.id });
  if (!done.length) return false;
  await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, id));
  return true;
}

// ---------------------------------------------------------------- /v1/users*

const RANK = () => new ApiError("forbidden", "This user has permissions your role doesn't hold. Ask an administrator who has all of them.");
const DUPLICATE = () => new ApiError("duplicate", "Another user already has this username or email. Use different ones.");
const UNKNOWN_ROLE = () => new ApiError("bad_request", "One of the roles doesn't exist. Pick roles from the list.");
const SESSION_GONE = () => new ApiError("not_found", "This session doesn't exist or has already ended.");

/**
 * The users among `ids` (UUIDs) with role names (A–Z), linked providers and effective permissions (catalog order), read
 * through `tx` (a transaction sees its own changes): sub-selects in the one query, never a query per row.
 */
export async function usersByIds(tx: Tx, ids: string[]): Promise<UserRowDto[]> {
  if (!ids.length) return [];
  const rows = await tx.select({ ...getTableColumns(users), roles: rolesOf(users.id), connected: providersOf(users.id), perms: permsOf(users.id) })
    .from(users).where(inArray(users.id, ids));
  return rows.map((r) => ({ ...UserDto.parse(toUserRow(r)), permissions: inCatalogOrder(r.perms) }));
}

/**
 * Locks the rows of `ids` for the transaction (in id order, so two bulk requests never deadlock), then reads them:
 * after the lock, so a change committed meanwhile is seen.
 */
async function lockUsers(tx: Tx, ids: string[]): Promise<Map<string, UserRowDto>> {
  if (ids.length) await tx.select({ id: users.id }).from(users).where(inArray(users.id, ids)).orderBy(users.id).for("update");
  return new Map((await usersByIds(tx, ids)).map((u) => [u.id, u]));
}

// Never signed in = no value, last both ways (as the mock's sorter); the users_* list indexes cover these expressions.
const USER_SORTS = {
  name: sql`lower(${users.name})`, email: sql`lower(${users.email})`, lastLoginAt: sql`${users.lastLoginAt} is null, ${users.lastLoginAt}`, createdAt: users.createdAt,
};

/**
 * One page of users (GET /v1/users): `q` matches name, username or email; `role` (any letter case) and `status` are
 * exact. The page is paged by id first, then one query reads those rows: on an index-ordered scan PostgreSQL would
 * run the sub-selects for every row the OFFSET skips (497 ms for page 1000 × 100 on 100k users).
 */
/** The users list's search and filters as a WHERE clause (the list and a bulk action with `filter` share it). */
function userWhere(q: BulkUserFilter) {
  const needle = q.q?.trim();
  const like = `%${likeEscape(needle ?? "")}%`;
  return and(
    needle ? or(ilike(users.name, like), ilike(users.username, like), ilike(users.email, like)) : undefined,
    q.role
      ? exists(db.select(one).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(eq(userRoles.userId, users.id), eq(sql`lower(${roles.name})`, sql`lower(${q.role})`))))
      : undefined,
    q.status ? eq(users.isActive, q.status === "active") : undefined,
  );
}

export async function userPage(q: UserListQuery): Promise<Page<UserRowDto>> {
  const where = userWhere(q);
  const page = await pageQuery({
    rows: db.select({ id: users.id }).from(users).where(where).$dynamic(),
    count: db.select(one).from(users).where(where).$dynamic(),
    orderBy: sortSql(q.sort, USER_SORTS, "name", users.id),
    query: q,
    map: (r) => r.id,
  });
  const rows = new Map((await usersByIds(db, page.items)).map((u) => [u.id, u]));
  return { ...page, items: page.items.flatMap((id) => rows.get(id) ?? []) }; // a user deleted in between drops out
}

/** The last 20 activity entries targeting `userId`, newest first, without target or snapshots. */
async function recentActivity(userId: string): Promise<ActivityBrief[]> {
  const rows = await db.select({ id: activity.id, at: activity.at, actorName: activity.actorName, action: activity.action }).from(activity)
    .where(eq(activity.targetId, userId)).orderBy(desc(activity.at), desc(activity.id)).limit(20);
  return rows.map((a) => ({ id: a.id, at: a.at.toISOString(), actor: { name: a.actorName }, action: a.action }));
}

/** User `id` (404 when missing); its audit history only `withActivity` (audit.view), and without before/after snapshots. */
export async function userDetail(id: string, withActivity: boolean): Promise<UserDetailDto> {
  const [u] = await usersByIds(db, [id]);
  if (!u) throw notFound("user");
  return { ...u, recentActivity: withActivity ? await recentActivity(id) : null };
}

/** User `id` exists. */
export async function userExists(id: string): Promise<boolean> {
  return (await db.select(one).from(users).where(eq(users.id, id))).length === 1;
}

/**
 * Active Superadmins other than `userId`, counted after taking the Superadmin lock: two changes that could each remove
 * one of the last two run one after the other, and the second sees the first.
 */
async function otherSuperadmins(tx: Tx, userId: string): Promise<number> {
  await xactLock(tx, "superadmin");
  const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.name, SUPERADMIN), eq(users.isActive, true), ne(users.id, userId)));
  return c!.n;
}

/** The actor's permissions, read now; 403 when `u` holds one the actor lacks (actor rank). */
async function actorOver(tx: Tx, ctx: Ctx, u: UserRowDto): Promise<Set<PermissionName>> {
  const actor = await actorPermissions(tx, ctx.user.id);
  if (checkTargetRank(actor, u.permissions)) throw RANK();
  return actor;
}

/** The user `id`, row-locked (404 when missing), and the actor's permissions read after the lock (actor rank checked). */
async function lockTarget(tx: Tx, ctx: Ctx, id: string): Promise<{ u: UserRowDto; actor: Set<PermissionName> }> {
  const u = (await lockUsers(tx, [id])).get(id);
  if (!u) throw notFound("user");
  return { u, actor: await actorOver(tx, ctx, u) };
}

/** checkUserChange with the other active Superadmins counted under the Superadmin lock. */
const userChange = (tx: Tx, ctx: Ctx, u: UserRowDto, change: UserChange) => checkUserChange(ctx.user.id, u, change, () => otherSuperadmins(tx, u.id));

/** The rule for setting a user active or inactive (deactivating: not yourself, not the last active Superadmin); PATCH isActive, /status and bulk share it. */
const statusRule = async (tx: Tx, ctx: Ctx, u: UserRowDto, active: boolean): Promise<ErrorCode | null> =>
  active ? null : userChange(tx, ctx, u, { kind: "deactivate" });

/**
 * Sets it: deactivating ends the user's sessions and spends their reset and invitation links; one entry, user.activate /
 * user.deactivate with { isActive }. Unchanged = nothing.
 */
async function applyStatus(tx: InTx, ctx: Ctx, u: UserRowDto, active: boolean): Promise<void> {
  if (u.isActive === active) return;
  await updateUser(tx, u.id, { isActive: active });
  if (!active) {
    await endUserSessions(tx, u.id);
    await deleteUserTokens(tx, u.id);
  }
  await recordActivity(tx, ctx, { action: active ? "user.activate" : "user.deactivate", target: { type: "user", id: u.id, label: u.name }, before: { isActive: !active }, after: { isActive: active } });
}

/** Deletes the user; sessions, identities, links and role grants go with the row (foreign keys). Activity keeps its names. */
async function deleteUser(tx: InTx, ctx: Ctx, u: UserRowDto): Promise<void> {
  await tx.delete(users).where(eq(users.id, u.id));
  await recordActivity(tx, ctx, { action: "user.delete", target: { type: "user", id: u.id, label: u.name }, before: UserDto.parse(u) });
}

/** 403 for the first role the actor may not grant or remove (it carries a permission they lack). */
function roleGrantDenied(actor: ReadonlySet<PermissionName>, rs: RoleRef[]): void {
  const r = rs.find((x) => checkRoleGrant(actor, x));
  if (r) throw new ApiError("forbidden", `Your role doesn't allow granting or removing ${r.name}. Ask an administrator who has all its permissions.`);
}

/** New user with a password, an invitation (72 h set-password link, mailed after the commit) or neither (directory user). */
export async function createUser(ctx: Ctx, b: CreateUserBody): Promise<UserDto> {
  const hash = b.password ? await hashPassword(b.password) : null;
  const token = b.invite ? randomToken() : null;
  const dto = await db.transaction(async (tx) => {
    const rs = canonical(b.roles, await rolesByName(tx, b.roles));
    if (!rs) throw UNKNOWN_ROLE();
    roleGrantDenied(await actorPermissions(tx, ctx.user.id), rs);
    const id = Bun.randomUUIDv7();
    const made = await tx.insert(users).values({ id, name: b.name, username: b.username, email: b.email, isActive: b.isActive, isLdap: b.isLdap, passwordHash: hash })
      .onConflictDoNothing().returning({ id: users.id });
    if (!made.length) throw DUPLICATE();
    await grantRoles(tx, id, rs.map((r) => r.id));
    // One live link per user, stored hashed; POST /v1/auth/reset spends it.
    if (token) await createInvite(tx, id, token);
    const dto = UserDto.parse((await usersByIds(tx, [id]))[0]);
    await recordActivity(tx, ctx, { action: "user.create", target: { type: "user", id, label: dto.name }, after: { ...dto, invited: !!b.invite } });
    return dto;
  });
  if (token) {
    sendMail({
      to: dto.email,
      subject: "Your account is ready",
      text: `An administrator created an account for you. Open this link within 72 hours to choose your password:\n\n`
        + `${config().APP_URL}/reset-password?token=${token}\n\nIf you weren't expecting this, ignore this email.`,
    });
  }
  return dto;
}

/**
 * Bulk activate / deactivate / delete / assignRole. Each id is checked on its own: protected rows (yourself, the last
 * active Superadmin, a user who outranks you, a user who already holds MAX_USER_ROLES roles, unknown ids) are skipped
 * with a code; only `done` ids are applied, and only changes reach the activity log.
 */
// ponytail: one transaction per bulk request: up to 100 row locks and ~400 statements (lock, read, per-row Superadmin
// count, change, entry), and the Superadmin lock held until commit once a Superadmin target is checked. Chunk the ids if
// bulk requests start queueing other user edits.
/** Ids of every user `filter` matches (by name), or 400 when more than BULK_ALL_MAX do: nothing is changed then. */
async function matchingIds(tx: InTx, filter: BulkUserFilter): Promise<string[]> {
  const found = await tx.select({ id: users.id }).from(users).where(userWhere(filter)).orderBy(asc(users.name), asc(users.id)).limit(BULK_ALL_MAX + 1);
  if (found.length > BULK_ALL_MAX) throw new ApiError("bad_request", `More than ${BULK_ALL_MAX.toLocaleString("en-US")} users match. Narrow the search or filters.`);
  return found.map((u) => u.id);
}

/** A bulk action on `ids`, or on every user `filter` matches (resolved inside the transaction, at most BULK_ALL_MAX). */
export async function bulkUsers(ctx: Ctx, b: BulkUserBody): Promise<BulkResult> {
  const { action, role: roleName } = b;
  return db.transaction(async (tx) => {
    const ids = b.filter ? await matchingIds(tx, b.filter) : [...new Set(b.ids)];
    const role = roleName === undefined ? undefined : (await rolesByName(tx, [roleName])).get(roleName.toLowerCase());
    if (action === "assignRole" && !role) throw new ApiError("bad_request", "This role doesn't exist. Pick a role from the list.");
    const found = await lockUsers(tx, ids.filter(isUuid));
    const actor = await actorPermissions(tx, ctx.user.id);
    const grant = role ? checkRoleGrant(actor, role) : null;
    const rule = async (u: UserRowDto): Promise<ErrorCode | null> => {
      if (action === "activate" || action === "deactivate") return statusRule(tx, ctx, u, action === "activate");
      if (action === "delete") return userChange(tx, ctx, u, { kind: "delete" });
      if (u.roles.includes(role!.name)) return (await userChange(tx, ctx, u, { kind: "setRoles", roles: u.roles })) ?? grant;
      if (u.roles.length >= MAX_USER_ROLES) return "bad_request";
      return (await userChange(tx, ctx, u, { kind: "setRoles", roles: [...u.roles, role!.name] })) ?? grant;
    };
    return bulk(
      ids,
      async (id) => {
        const u = found.get(id);
        return u ? checkTargetRank(actor, u.permissions) ?? (await rule(u)) : "not_found";
      },
      async (id) => {
        const u = found.get(id)!;
        if (action === "activate" || action === "deactivate") return applyStatus(tx, ctx, u, action === "activate");
        if (action === "delete") return deleteUser(tx, ctx, u);
        if (u.roles.includes(role!.name)) return; // already held: nothing to change, no entry
        await grantRoles(tx, id, [role!.id]);
        const [after] = await usersByIds(tx, [id]);
        await recordActivity(tx, ctx, { action: "user.assign_role", target: { type: "user", id, label: u.name }, before: { roles: u.roles }, after: { roles: after!.roles } });
      },
    );
  });
}

const FIELDS = ["name", "username", "email", "roles"] as const;

/**
 * Edit name, username, email, roles and status. Every rule is checked before anything changes. Changed fields log one
 * user.update entry with only those fields; a status change logs user.activate / user.deactivate (as POST /status).
 * Nothing to change → the user, no activity entry.
 */
export async function editUser(ctx: Ctx, id: string, b: UpdateUserBody): Promise<UserDto> {
  return db.transaction(async (tx) => {
    const u = (await lockUsers(tx, [id])).get(id);
    if (!u) throw notFound("user");
    const rs = b.roles ? canonical(b.roles, await rolesByName(tx, b.roles)) : undefined; // share-locks the roles named
    const actor = await actorOver(tx, ctx, u); // after the role locks: a role edit committed meanwhile counts
    if (rs === null) throw UNKNOWN_ROLE();
    if ((b.username !== undefined || b.email !== undefined) && (await duplicateOf(tx, b.username, b.email, id))) throw DUPLICATE();
    // Compared by id with the roles held now: a rename since `u` was read changes nothing here.
    const held = rs ? await rolesOfUser(tx, id) : [];
    const added = rs?.filter((r) => !held.some((h) => h.id === r.id)) ?? [];
    const removed = rs ? held.filter((h) => !rs.some((r) => r.id === h.id)) : [];
    const rolesChange = added.length > 0 || removed.length > 0;
    if (rolesChange) {
      roleGrantDenied(actor, [...added, ...removed]);
      const stop = await userChange(tx, ctx, u, { kind: "setRoles", roles: rs!.map((r) => r.name) });
      if (stop) throw new ApiError(stop);
    }
    const statusChange = b.isActive !== undefined && b.isActive !== u.isActive;
    if (statusChange) {
      const stop = await statusRule(tx, ctx, u, b.isActive!);
      if (stop) throw new ApiError(stop);
    }
    const name = b.name ?? u.name, username = b.username ?? u.username, email = b.email ?? u.email;
    const fieldsChange = name !== u.name || username !== u.username || email !== u.email;
    if (fieldsChange || rolesChange) {
      try {
        await updateUser(tx, id, { name, username, email });
      } catch (e) {
        throw isUniqueViolation(e) ? DUPLICATE() : e;
      }
      if (email !== u.email) await deleteUserTokens(tx, id); // the links went to the old address
    }
    await revokeRoles(tx, id, removed.map((r) => r.id));
    await grantRoles(tx, id, added.map((r) => r.id));
    const [after] = await usersByIds(tx, [id]);
    const before = { ...u, roles: rs ? held.map((r) => r.name) : u.roles };
    const changed = FIELDS.filter((k) => (k === "roles" ? rolesChange : before[k] !== after![k]));
    if (changed.length) {
      const pick = (d: UserRowDto) => Object.fromEntries(changed.map((k) => [k, d[k]]));
      await recordActivity(tx, ctx, { action: "user.update", target: { type: "user", id, label: after!.name }, before: pick(before), after: pick(after!) });
    }
    if (statusChange) await applyStatus(tx, ctx, after!, b.isActive!);
    return UserDto.parse({ ...after, isActive: b.isActive ?? after!.isActive });
  });
}

/** Deletes another user (not yourself, not the last active Superadmin, not one who outranks you). */
export async function removeUser(ctx: Ctx, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { u } = await lockTarget(tx, ctx, id);
    const stop = await userChange(tx, ctx, u, { kind: "delete" });
    if (stop) throw new ApiError(stop);
    await deleteUser(tx, ctx, u);
  });
}

/** Admin reset: a random password, returned once (never logged); the user's sessions end and their links are spent. */
export async function resetUserPassword(ctx: Ctx, id: string): Promise<string> {
  const password = temporaryPassword();
  // ponytail: hashed before the row lock (argon2 is slow on purpose), so a refused request (404/403/409) still costs one hash; fine on a user.edit-guarded route.
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const { u } = await lockTarget(tx, ctx, id);
    if (u.id === ctx.user.id) throw new ApiError("self_action"); // the reset would end the actor's own sessions; use Security
    const stop = checkPasswordOp(u);
    if (stop) throw new ApiError(stop);
    await updateUser(tx, id, { passwordHash: hash });
    await endUserSessions(tx, id);
    await deleteUserTokens(tx, id);
    await recordActivity(tx, ctx, { action: "user.reset_password", target: { type: "user", id, label: u.name } });
  });
  return password;
}

/** Activate or deactivate (the same rule and activity as PATCH isActive). Deactivating ends the user's sessions. */
export async function setUserStatus(ctx: Ctx, id: string, active: boolean): Promise<UserDto> {
  return db.transaction(async (tx) => {
    const { u } = await lockTarget(tx, ctx, id);
    const stop = await statusRule(tx, ctx, u, active);
    if (stop) throw new ApiError(stop);
    await applyStatus(tx, ctx, u, active);
    return UserDto.parse({ ...u, isActive: active });
  });
}

/** End one live session of another user. A session that isn't theirs, or has ended, answers like an unknown one. */
export async function endSessionOf(ctx: Ctx, id: string, sid: string): Promise<void> {
  if (!isUuid(id) || !isUuid(sid)) throw SESSION_GONE();
  await db.transaction(async (tx) => {
    const u = (await lockUsers(tx, [id])).get(id);
    // Only a live session: an ended one answers like an unknown one (the mock pruned before looking it up).
    const [s] = u ? await tx.select({ device: sessions.device }).from(sessions).where(and(eq(sessions.id, sid), eq(sessions.userId, id), sessionLive())) : [];
    if (!u || !s) throw SESSION_GONE();
    await actorOver(tx, ctx, u);
    if (sid === ctx.sid) throw currentSession();
    await endSession(sid, tx);
    await recordActivity(tx, ctx, { action: "user.session_end", target: { type: "user", id, label: u.name }, after: { session: s.device } });
  });
}
