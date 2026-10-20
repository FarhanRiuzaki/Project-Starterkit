// /v1/users*: port of apps/web/src/app/api/users/** and lib/server/users.ts (/v1/users/roles lives in rbac/routes.ts).
// Every check that compares the actor with another user runs inside the transaction: the target rows are locked
// first, then the actor's permissions are read (never the request's earlier ctx.perms).
import { randomInt } from "node:crypto";
import { Hono } from "hono";
import type { ErrorCode } from "@starterkit/shared/contracts/common";
import { SessionListQuery } from "@starterkit/shared/contracts/me";
import { BulkUserBody, CreateUserBody, MAX_USER_ROLES, SetUserStatusBody, UpdateUserBody, UserDto, UserListQuery, type UserRowDto } from "@starterkit/shared/contracts/users";
import type { PermissionName } from "@starterkit/shared/permissions";
import { recordActivity } from "../audit/record";
import { hashToken, randomToken } from "../auth/crypto";
import { hashPassword } from "../auth/password";
import { actorPermissions, endUserSessions } from "../auth/sessions";
import { config } from "../config";
import { sql, type Tx } from "../db/client";
import { ApiError, currentSession, notFound } from "../http/errors";
import { type Ctx, guard } from "../http/guard";
import type { AppEnv } from "../http/middleware";
import { body, idParam, isUuid, query } from "../http/parse";
import { sendMail } from "../mail/mailer";
import { checkRoleGrant } from "../rbac/rules";
import { duplicateOf, lockUsers, otherSuperadmins, recentActivity, type RoleRef, rolesByName, sessionPage, userPage, usersByIds } from "./queries";
import { bulk, checkPasswordOp, checkTargetRank, checkUserChange, type UserChange } from "./rules";

export const usersRoutes = new Hono<AppEnv>();

const RANK = () => new ApiError("forbidden", "This user has permissions your role doesn't hold. Ask an administrator who has all of them.");
const DUPLICATE = () => new ApiError("duplicate", "Another user already has this username or email. Use different ones.");
const UNKNOWN_ROLE = () => new ApiError("bad_request", "One of the roles doesn't exist. Pick roles from the list.");
const SESSION_GONE = () => new ApiError("not_found", "This session doesn't exist or has already ended.");
const isUniqueViolation = (e: unknown) => (e as { errno?: string }).errno === "23505";

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

/** checkUserChange with the other active Superadmins counted under SUPERADMIN_LOCK. */
const userChange = (tx: Tx, ctx: Ctx, u: UserRowDto, change: UserChange) => checkUserChange(ctx.user.id, u, change, () => otherSuperadmins(tx, u.id));

/** The rule for setting a user active or inactive (deactivating: not yourself, not the last active Superadmin); PATCH isActive, /status and bulk share it. */
const statusRule = async (tx: Tx, ctx: Ctx, u: UserRowDto, active: boolean): Promise<ErrorCode | null> =>
  active ? null : userChange(tx, ctx, u, { kind: "deactivate" });

/** Sets it: deactivating ends the user's sessions; one entry, user.activate / user.deactivate with { isActive }. Unchanged = nothing. */
async function applyStatus(tx: Tx, ctx: Ctx, u: UserRowDto, active: boolean): Promise<void> {
  if (u.isActive === active) return;
  await tx`update users set is_active = ${active}, updated_at = now() where id = ${u.id}`;
  if (!active) await endUserSessions(tx, u.id);
  await recordActivity(tx, ctx, { action: active ? "user.activate" : "user.deactivate", target: { type: "user", id: u.id, label: u.name }, before: { isActive: !active }, after: { isActive: active } });
}

/** Deletes the user; sessions, identities, links and role grants go with the row (foreign keys). Activity keeps its names. */
async function deleteUser(tx: Tx, ctx: Ctx, u: UserRowDto): Promise<void> {
  await tx`delete from users where id = ${u.id}`;
  await recordActivity(tx, ctx, { action: "user.delete", target: { type: "user", id: u.id, label: u.name }, before: UserDto.parse(u) });
}

/** 403 for the first role the actor may not grant or remove (it carries a permission they lack). */
function roleGrantDenied(actor: ReadonlySet<PermissionName>, roles: RoleRef[]): void {
  const r = roles.find((x) => checkRoleGrant(actor, x));
  if (r) throw new ApiError("forbidden", `Your role doesn't allow granting or removing ${r.name}. Ask an administrator who has all its permissions.`);
}

/** `names` as roles (any letter case, deduplicated), or null when one isn't a role (unknown, or a name from before a rename). */
function canonical(names: readonly string[], known: Map<string, RoleRef>): RoleRef[] | null {
  const out = names.map((n) => known.get(n.toLowerCase()));
  return out.every((r) => r !== undefined) ? [...new Set(out as RoleRef[])] : null;
}

/** 18 random chars from an alphabet without look-alikes, plus one of each class so any password rule passes; unbiased (randomInt) and shuffled. */
function temporaryPassword(): string {
  const pick = (set: string) => set[randomInt(set.length)]!;
  const all = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = [pick("abcdefghijkmnpqrstuvwxyz"), pick("ABCDEFGHJKLMNPQRSTUVWXYZ"), pick("23456789"), pick("-_!#"), ...Array.from({ length: 14 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

usersRoutes.get("/users", async (c) => {
  const q = query(c, UserListQuery);
  await guard(c, "user.view");
  return c.json(await userPage(q));
});

/** New user with a password, an invitation (72 h set-password link, mailed after the commit) or neither (directory user). */
usersRoutes.post("/users", async (c) => {
  const ctx = await guard(c, "user.create");
  const b = await body(c, CreateUserBody);
  const hash = b.password ? await hashPassword(b.password) : null;
  const token = b.invite ? randomToken() : null;
  const dto = await sql.begin(async (tx) => {
    const roles = canonical(b.roles, await rolesByName(tx, b.roles));
    if (!roles) throw UNKNOWN_ROLE();
    roleGrantDenied(await actorPermissions(tx, ctx.user.id), roles);
    const id = Bun.randomUUIDv7();
    const [made] = await tx`insert into users (id, name, username, email, is_active, is_ldap, password_hash)
      values (${id}, ${b.name}, ${b.username}, ${b.email}, ${b.isActive}, ${b.isLdap}, ${hash}) on conflict do nothing returning id`;
    if (!made) throw DUPLICATE();
    if (roles.length) await tx`insert into user_roles ${tx(roles.map((r) => ({ user_id: id, role_id: r.id })))}`;
    // One live link per user, stored hashed; POST /v1/auth/reset spends it.
    if (token) await tx`insert into user_tokens (token_hash, user_id, kind, expires_at) values (${hashToken(token)}, ${id}, 'invite', now() + interval '72 hours')`;
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
  return c.json(dto, 201);
});

/**
 * Bulk activate / deactivate / delete / assignRole. Each id is checked on its own: protected rows (yourself, the last
 * active Superadmin, a user who outranks you, a user who already holds MAX_USER_ROLES roles, unknown ids) are skipped
 * with a code; only `done` ids are applied, and only changes reach the activity log.
 */
usersRoutes.post("/users/bulk", async (c) => {
  // The action picks the permission (delete needs user.delete), but a bad body still answers 400 after the guard.
  const parsed = await body(c, BulkUserBody).then((b) => ({ b }), (e: unknown) => ({ e }));
  const ctx = await guard(c, "b" in parsed && parsed.b.action === "delete" ? "user.delete" : "user.edit");
  if ("e" in parsed) throw parsed.e;
  const { action, role: roleName } = parsed.b;
  const ids = [...new Set(parsed.b.ids)];
  const res = await sql.begin(async (tx) => {
    const role = roleName === undefined ? undefined : (await rolesByName(tx, [roleName])).get(roleName.toLowerCase());
    if (action === "assignRole" && !role) throw new ApiError("bad_request", "This role doesn't exist. Pick a role from the list.");
    const users = await lockUsers(tx, ids.filter(isUuid));
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
        const u = users.get(id);
        return u ? checkTargetRank(actor, u.permissions) ?? (await rule(u)) : "not_found";
      },
      async (id) => {
        const u = users.get(id)!;
        if (action === "activate" || action === "deactivate") return applyStatus(tx, ctx, u, action === "activate");
        if (action === "delete") return deleteUser(tx, ctx, u);
        if (u.roles.includes(role!.name)) return; // already held: nothing to change, no entry
        await tx`insert into user_roles (user_id, role_id) values (${id}, ${role!.id})`;
        const [after] = await usersByIds(tx, [id]);
        await recordActivity(tx, ctx, { action: "user.assign_role", target: { type: "user", id, label: u.name }, before: { roles: u.roles }, after: { roles: after!.roles } });
      },
    );
  });
  return c.json(res);
});

usersRoutes.get("/users/:id", async (c) => {
  const ctx = await guard(c, "user.view");
  const id = idParam(c, "id", "user");
  const [u] = await usersByIds(sql, [id]);
  if (!u) throw notFound("user");
  // Audit history needs audit.view; the entries carry no before/after snapshots.
  return c.json({ ...u, recentActivity: ctx.perms.has("audit.view") ? await recentActivity(id) : null });
});

const FIELDS = ["name", "username", "email", "roles"] as const;

/**
 * Edit name, username, email, roles and status. Every rule is checked before anything changes. Changed fields log one
 * user.update entry with only those fields; a status change logs user.activate / user.deactivate (as POST /status).
 * Nothing to change → 200 with the user, no activity entry.
 */
usersRoutes.patch("/users/:id", async (c) => {
  const ctx = await guard(c, "user.edit");
  const b = await body(c, UpdateUserBody);
  const id = idParam(c, "id", "user");
  const dto = await sql.begin(async (tx) => {
    const { u, actor } = await lockTarget(tx, ctx, id);
    const known = b.roles ? await rolesByName(tx, [...b.roles, ...u.roles]) : new Map<string, RoleRef>();
    const roles = b.roles ? canonical(b.roles, known) : undefined;
    if (roles === null) throw UNKNOWN_ROLE();
    if ((b.username !== undefined || b.email !== undefined) && (await duplicateOf(tx, b.username, b.email, id))) throw DUPLICATE();
    const added = roles?.filter((r) => !u.roles.includes(r.name)) ?? [];
    const removed = roles ? u.roles.filter((n) => !roles.some((r) => r.name === n)).map((n) => known.get(n.toLowerCase())!) : [];
    if (added.length || removed.length) {
      roleGrantDenied(actor, [...added, ...removed]);
      const stop = await userChange(tx, ctx, u, { kind: "setRoles", roles: roles!.map((r) => r.name) });
      if (stop) throw new ApiError(stop);
    }
    const statusChange = b.isActive !== undefined && b.isActive !== u.isActive;
    if (statusChange) {
      const stop = await statusRule(tx, ctx, u, b.isActive!);
      if (stop) throw new ApiError(stop);
    }
    const name = b.name ?? u.name, username = b.username ?? u.username, email = b.email ?? u.email;
    const fieldsChange = name !== u.name || username !== u.username || email !== u.email;
    if (fieldsChange || added.length || removed.length) {
      try {
        await tx`update users set name = ${name}, username = ${username}, email = ${email}, updated_at = now() where id = ${id}`;
      } catch (e) {
        throw isUniqueViolation(e) ? DUPLICATE() : e;
      }
    }
    if (removed.length) await tx`delete from user_roles where user_id = ${id} and role_id in ${tx(removed.map((r) => r.id))}`;
    if (added.length) await tx`insert into user_roles ${tx(added.map((r) => ({ user_id: id, role_id: r.id })))}`;
    const [after] = await usersByIds(tx, [id]);
    const changed = FIELDS.filter((k) => JSON.stringify(u[k]) !== JSON.stringify(after![k]));
    if (changed.length) {
      const pick = (d: UserRowDto) => Object.fromEntries(changed.map((k) => [k, d[k]]));
      await recordActivity(tx, ctx, { action: "user.update", target: { type: "user", id, label: after!.name }, before: pick(u), after: pick(after!) });
    }
    if (statusChange) await applyStatus(tx, ctx, after!, b.isActive!);
    return UserDto.parse({ ...after, isActive: b.isActive ?? after!.isActive });
  });
  return c.json(dto);
});

usersRoutes.delete("/users/:id", async (c) => {
  const ctx = await guard(c, "user.delete");
  const id = idParam(c, "id", "user");
  await sql.begin(async (tx) => {
    const { u } = await lockTarget(tx, ctx, id);
    const stop = await userChange(tx, ctx, u, { kind: "delete" });
    if (stop) throw new ApiError(stop);
    await deleteUser(tx, ctx, u);
  });
  return c.json({ ok: true });
});

/** Admin reset: a random password, shown once in the answer (never logged); the user's sessions end and their links are spent. */
usersRoutes.post("/users/:id/reset-password", async (c) => {
  const ctx = await guard(c, "user.edit");
  const id = idParam(c, "id", "user");
  const password = temporaryPassword();
  const hash = await hashPassword(password); // before the row lock: argon2 is slow on purpose
  await sql.begin(async (tx) => {
    const { u } = await lockTarget(tx, ctx, id);
    if (u.id === ctx.user.id) throw new ApiError("self_action"); // the reset would end the actor's own sessions; use Security
    const stop = checkPasswordOp(u);
    if (stop) throw new ApiError(stop);
    await tx`update users set password_hash = ${hash}, updated_at = now() where id = ${id}`;
    await endUserSessions(tx, id);
    await tx`delete from user_tokens where user_id = ${id}`;
    await recordActivity(tx, ctx, { action: "user.reset_password", target: { type: "user", id, label: u.name } });
  });
  return c.json({ temporaryPassword: password });
});

/** Activate or deactivate (the same rule and activity as PATCH isActive). Deactivating ends the user's sessions. */
usersRoutes.post("/users/:id/status", async (c) => {
  const ctx = await guard(c, "user.edit");
  const { active } = await body(c, SetUserStatusBody);
  const id = idParam(c, "id", "user");
  const dto = await sql.begin(async (tx) => {
    const { u } = await lockTarget(tx, ctx, id);
    const stop = await statusRule(tx, ctx, u, active);
    if (stop) throw new ApiError(stop);
    await applyStatus(tx, ctx, u, active);
    return UserDto.parse({ ...u, isActive: active });
  });
  return c.json(dto);
});

/** One page of a user's live sessions, newest activity first unless `sort` says otherwise; the caller's own is marked current. */
usersRoutes.get("/users/:id/sessions", async (c) => {
  const q = query(c, SessionListQuery);
  const ctx = await guard(c, "user.view");
  const id = idParam(c, "id", "user");
  if (!(await sql`select 1 from users where id = ${id}`).length) throw notFound("user");
  return c.json(await sessionPage(id, q, ctx.sid));
});

/** End one session of another user. A session that isn't theirs answers like an unknown one. */
usersRoutes.delete("/users/:id/sessions/:sid", async (c) => {
  const ctx = await guard(c, "user.edit");
  const { id, sid } = c.req.param();
  if (!isUuid(id) || !isUuid(sid)) throw SESSION_GONE();
  await sql.begin(async (tx) => {
    const u = (await lockUsers(tx, [id])).get(id);
    const [s] = u ? await tx`select device from sessions where id = ${sid} and user_id = ${id}` : [];
    if (!u || !s) throw SESSION_GONE();
    await actorOver(tx, ctx, u);
    if (sid === ctx.sid) throw currentSession();
    await tx`delete from sessions where id = ${sid}`;
    await recordActivity(tx, ctx, { action: "user.session_end", target: { type: "user", id, label: u.name }, after: { session: s.device } });
  });
  return c.json({ ok: true });
});
