// Port of apps/web/src/app/api/users/users-routes.test.ts against /v1/users*, test for test with the same names.
// Not ported: the wrong csrf-token half of "DELETE session refuses …" (the web checks CSRF, Task 9).
// Differences: ids are UUIDs (looked up by username); a user's roles come back A–Z (user_roles keeps no order).
import { beforeEach, describe, expect, it } from "bun:test";
import type { Page } from "@starterkit/shared/contracts/common";
import { BULK_ALL_MAX, type UserDetailDto, type UserDto, type UserRowDto } from "@starterkit/shared/contracts/users";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { call, resetData, signIn } from "../../../../../test/helpers/app";
import { holdTx, lockWaiters, rows, sqlColumns } from "../../../../../test/helpers/db";
import { SEED_PASSWORD } from "../../../../db/seed/demo";
import { hashToken } from "../../../../kernel/crypto";
import { db } from "../../../../kernel/db";
import { xactLock } from "../../../../kernel/locks";
import { clearMail, sentMail } from "../../../../kernel/mailer";
import { activity } from "../../../audit";
import { createSession, sessions, userTokens, verifyPassword } from "../../../auth";
import { userIdentities } from "../../../oauth";
import { rolePermissions, roles, userRoles } from "../../../rbac";
import { users } from "../../schema";

const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
const idOf = async (username: string): Promise<string> => (await rows(db.select({ id: users.id }).from(users).where(eq(users.username, username))))[0].id;
const roleIdOf = async (name: string): Promise<string> => (await rows(db.select({ id: roles.id }).from(roles).where(eq(roles.name, name))))[0].id;
const sidOf = async (token: string): Promise<string> => (await rows(db.select({ id: sessions.id }).from(sessions).where(eq(sessions.tokenHash, hashToken(token)))))[0].id;
const addSession = async (userId: string): Promise<string> =>
  (await db.transaction((tx) => createSession(tx, { userId, method: "password", client: { ip: "10.0.0.9", ua: "bun test" } }))).id;
const hasSession = async (id: string) => (await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, id))).length === 1;
const userRow = async (id: string) => (await rows(db.select(sqlColumns(users)).from(users).where(eq(users.id, id))))[0];
const rolesOf = async (id: string): Promise<string[]> =>
  (await db.select({ name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, id)).orderBy(roles.name)).map((r) => r.name);
const userCount = async (): Promise<number> => db.$count(users);
type Act = { id: string; action: string; targetId: string; targetLabel: string; actorName: string; before: unknown; after: unknown };
/** Activity written by this test (beforeEach empties the table), oldest first. */
const acts = async (): Promise<Act[]> =>
  await db.select({ id: activity.id, action: activity.action, targetId: activity.targetId, targetLabel: activity.targetLabel, actorName: activity.actorName, before: activity.before, after: activity.after })
    .from(activity).orderBy(asc(activity.at), asc(activity.id));
/** Active holders of the Superadmin role. */
const activeSupers = async (): Promise<number> =>
  db.$count(userRoles, and(eq(userRoles.roleId, await roleIdOf("Superadmin")), inArray(userRoles.userId, db.select({ id: users.id }).from(users).where(eq(users.isActive, true)))));
/** `role` holds exactly `perms`. */
async function setPerms(role: string, perms: PermissionName[]) {
  const id = await roleIdOf(role);
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
  if (perms.length) await db.insert(rolePermissions).values(perms.map((permission) => ({ roleId: id, permission })));
}
/** `username` holds exactly the roles `names`. */
async function setRoles(username: string, names: string[]) {
  const id = await idOf(username);
  await db.delete(userRoles).where(eq(userRoles.userId, id));
  const held = await db.select({ id: roles.id }).from(roles).where(inArray(roles.name, names));
  await db.insert(userRoles).values(held.map((r) => ({ userId: id, roleId: r.id })));
}
/** A role "Custom" with exactly `perms`, the only role of `username`. */
async function giveOnlyRole(username: string, perms: PermissionName[]) {
  const id = Bun.randomUUIDv7();
  await db.insert(roles).values({ id, name: "Custom" });
  await db.insert(rolePermissions).values(perms.map((permission) => ({ roleId: id, permission })));
  await setRoles(username, ["Custom"]);
  return id;
}
/** A reset link `token` (stored hashed) for user `userId`, valid for an hour. */
const addToken = (userId: string, token: string) =>
  db.insert(userTokens).values({ tokenHash: hashToken(token), userId, kind: "reset", expiresAt: sql`now() + interval '1 hour'` });

const NEW = { name: "New Person", username: "new.person", email: "new.person@example.com", roles: ["Viewer"], isActive: true, isLdap: false, password: "Brand-New-Pass-1!" };

const get = (qs = "", token?: string) => call("GET", `/v1/users${qs}`, { token });
const create = (body: unknown, token: string) => call("POST", "/v1/users", { token, body });
const getOne = (id: string, token: string) => call("GET", `/v1/users/${id}`, { token });
const patch = (id: string, body: unknown, token: string) => call("PATCH", `/v1/users/${id}`, { token, body });
const del = (id: string, token: string) => call("DELETE", `/v1/users/${id}`, { token });
const setStatus = (id: string, body: unknown, token: string) => call("POST", `/v1/users/${id}/status`, { token, body });
const resetPassword = (id: string, token: string) => call("POST", `/v1/users/${id}/reset-password`, { token });
const bulk = (body: unknown, token: string) => call("POST", "/v1/users/bulk", { token, body });
const sessionsOf = (id: string, qs = "", token?: string) => call("GET", `/v1/users/${id}/sessions?${qs}`, { token });
const endSession = (id: string, sid: string, token: string) => call("DELETE", `/v1/users/${id}/sessions/${sid}`, { token });
const total = async (r: Response) => ((await r.json()) as { total: number }).total;

beforeEach(async () => {
  await resetData();
  await db.delete(activity);
  clearMail();
});

describe("GET /v1/users", () => {
  it.each([["page=0"], ["page=1001"], ["pageSize=7"], ["pageSize=10"], ["sort=password"], ["status=deleted"]])("rejects %s with 400 before guard", async (qs) => {
    // no session at all: a 401 here would mean the guard ran first
    expect((await get(`?${qs}`)).status).toBe(400);
    expect((await get(`?${qs}`, await signIn("viewer"))).status).toBe(400);
  });

  it("needs a session and user.view", async () => {
    expect((await get()).status).toBe(401);
    const viewer = await signIn("viewer");
    expect((await get("", viewer)).status).toBe(200);
    await setPerms("Viewer", []);
    expect((await get("", viewer)).status).toBe(403);
  });

  it("pages, sorts and filters; never returns secrets", async () => {
    const admin = await signIn("admin");
    const body = (await (await get("?pageSize=15&page=2&sort=-name", admin)).json()) as Page<UserRowDto>;
    expect(body).toMatchObject({ total: 50, page: 2, pageSize: 15 });
    expect(body.items).toHaveLength(15);
    const names = body.items.map((u) => u.name);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|totpSecret|recoveryCodes/);
    const inactive = (await (await get("?status=inactive&pageSize=100", admin)).json()) as Page<UserRowDto>;
    expect(inactive.items.length).toBeGreaterThan(0);
    expect(inactive.items.every((u) => !u.isActive)).toBe(true);
    expect(await total(await get("?role=Superadmin", admin))).toBe(1);
  });

  it("q matches name, username, email case-insensitively", async () => {
    const admin = await signIn("admin");
    const count = async (q: string) => total(await get(`?q=${encodeURIComponent(q)}`, admin));
    expect(await count("DIRECTORY USER")).toBe(1);
    expect(await count("GOOGLE")).toBe(1);
    expect(await count("apple@EXAMPLE.com")).toBe(1);
    expect(await count("zzz-no-match")).toBe(0);
  });

  it("q matches email substring", async () => {
    const admin = await signIn("admin");
    const page = (await (await get(`?q=${encodeURIComponent("ple@exa")}`, admin)).json()) as Page<UserRowDto>;
    expect(page.items.map((u) => u.username)).toEqual(["apple"]);
    // wildcards are literal
    expect(await total(await get(`?q=${encodeURIComponent("%@")}`, admin))).toBe(0);
    expect(await total(await get(`?q=${encodeURIComponent("_")}`, admin))).toBe(0);
  });

  it("role filter ignores case", async () => {
    const admin = await signIn("admin");
    const n = await db.$count(userRoles, eq(userRoles.roleId, await roleIdOf("Viewer")));
    expect(await total(await get("?role=vIeWeR", admin))).toBe(n);
    expect(await total(await get("?role=superADMIN", admin))).toBe(1);
    expect(await total(await get("?role=Nope", admin))).toBe(0);
  });

  it("page 1000 of 15 answers empty items with the real total", async () => {
    expect(await (await get("?page=1000", await signIn("admin"))).json()).toEqual({ items: [], total: 50, page: 1000, pageSize: 15 });
  });

  it("rows carry effective permissions in catalog order; never-signed-in users sort last both ways", async () => {
    const admin = await signIn("admin");
    const rows = ((await (await get("?pageSize=100", admin)).json()) as Page<UserRowDto>).items;
    const perms = (u: string) => rows.find((r) => r.username === u)!.permissions;
    expect(perms("superadmin")).toEqual([...PERMISSIONS]);
    expect(perms("viewer")).toEqual(["user.view", "audit.view"]);
    for (const sort of ["lastLoginAt", "-lastLoginAt"]) {
      const items = ((await (await get(`?pageSize=100&sort=${sort}`, admin)).json()) as Page<UserRowDto>).items;
      const firstNull = items.findIndex((u) => u.lastLoginAt === null);
      expect(firstNull).toBeGreaterThan(0);
      expect(items.slice(firstNull).every((u) => u.lastLoginAt === null)).toBe(true);
      const times = items.slice(0, firstNull).map((u) => Date.parse(u.lastLoginAt!));
      expect(times).toEqual([...times].sort((a, b) => (sort.startsWith("-") ? b - a : a - b)));
    }
  });
});

describe("GET /v1/users/roles", () => {
  const options = (qs = "", token?: string) => call("GET", `/v1/users/roles?${qs}`, { token });
  it("pages role options { id, name } by name with user.view and needs a session", async () => {
    expect((await options()).status).toBe(401);
    const viewer = await signIn("viewer");
    expect(await (await options("", viewer)).json()).toEqual({
      items: [{ id: await roleIdOf("Admin"), name: "Admin" }, { id: await roleIdOf("Superadmin"), name: "Superadmin" }, { id: await roleIdOf("Viewer"), name: "Viewer" }],
      total: 3, page: 1, pageSize: 15,
    });
    await setPerms("Viewer", []);
    expect((await options("", viewer)).status).toBe(403);
  });

  it("searches the name, pages, sorts descending; never unbounded", async () => {
    const viewer = await signIn("viewer");
    await db.insert(roles).values(Array.from({ length: 120 }, (_, i) => ({ id: Bun.randomUUIDv7(), name: `Team ${String(i).padStart(3, "0")}` })));
    const page = (await (await options("pageSize=100", viewer)).json()) as Page<{ name: string }>;
    expect(page.items).toHaveLength(100);
    expect(page.total).toBe(123);
    expect(((await (await options("q=team 11", viewer)).json()) as Page<{ name: string }>).items.map((r) => r.name)).toEqual(Array.from({ length: 10 }, (_, i) => `Team 11${i}`));
    expect(((await (await options("sort=-name&pageSize=15", viewer)).json()) as Page<{ name: string }>).items[0]!.name).toBe("Viewer");
  });

  it.each([["pageSize=500"], ["page=0"], ["sort=users"], ["sort=permissions"]])("rejects %s with 400 before the guard", async (qs) => {
    expect((await options(qs)).status).toBe(400);
  });

  it("GET /v1/users/roles is role options, not a user 404", async () => {
    const r = await options("", await signIn("viewer"));
    expect(r.status).toBe(200);
    expect(((await r.json()) as Page<{ name: string }>).items.map((x) => x.name)).toEqual(["Admin", "Superadmin", "Viewer"]);
  });
});

describe("POST /v1/users", () => {
  it("viewer gets 403 and the store is unchanged", async () => {
    const r = await create(NEW, await signIn("viewer"));
    expect(r.status).toBe(403);
    expect(await userCount()).toBe(50);
    expect(await acts()).toHaveLength(0);
  });

  it("creates a user with a password: hashed, DTO without secrets, one activity entry", async () => {
    const r = await create(NEW, await signIn("admin"));
    expect(r.status).toBe(201);
    const dto = (await r.json()) as UserDto;
    expect(dto).toMatchObject({ username: "new.person", roles: ["Viewer"], isActive: true, isLdap: false });
    expect(JSON.stringify(dto)).not.toMatch(/passwordHash|Brand-New/);
    expect(await verifyPassword(NEW.password, (await userRow(dto.id)).password_hash)).toBe(true);
    const a = await acts();
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ action: "user.create", targetId: dto.id, after: { ...dto, invited: false } });
    expect(JSON.stringify(a)).not.toMatch(/Brand-New|passwordHash/);
    expect(sentMail()).toHaveLength(0);
  });

  it("invite: no password, a 72 h set-password token that /api/auth/reset accepts", async () => {
    const { password: _p, ...rest } = NEW;
    const r = await create({ ...rest, invite: true }, await signIn("admin"));
    expect(r.status).toBe(201);
    const id = ((await r.json()) as { id: string }).id;
    expect((await userRow(id)).password_hash).toBeNull();
    const tokens = await rows(db.select({ kind: userTokens.kind, left: sql`extract(epoch from ${userTokens.expiresAt} - now())` }).from(userTokens).where(eq(userTokens.userId, id)));
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("invite");
    expect(Number(tokens[0].left)).toBeGreaterThan(71 * 3600);
    expect(Number(tokens[0].left)).toBeLessThanOrEqual(72 * 3600);
    expect((await acts())[0]!.after).toMatchObject({ id, invited: true });
    // The mail (sent after the commit) carries the only copy of the token.
    const mail = sentMail();
    expect(mail).toHaveLength(1);
    expect(mail[0]!.to).toBe(NEW.email);
    const token = /\/reset-password\?token=([\w-]+)/.exec(mail[0]!.text)![1]!;
    expect(JSON.stringify(await acts())).not.toContain(token);
    const done = await call("POST", "/v1/auth/reset", { body: { token, password: "Chosen-Pass-123!" } });
    expect(done.status).toBe(200);
    expect(await verifyPassword("Chosen-Pass-123!", (await userRow(id)).password_hash)).toBe(true);
  });

  it("an invite for an inactive user is 400: no user, no link mailed", async () => {
    const { password: _p, ...rest } = NEW;
    const before = await userCount();
    const r = await create({ ...rest, isActive: false, invite: true }, await signIn("admin"));
    expect(r.status).toBe(400);
    expect(await code(r)).toBe("bad_request");
    expect(await userCount()).toBe(before);
    expect(sentMail()).toHaveLength(0);
  });

  it("LDAP user with password or invite is 400; non-LDAP needs exactly one of password / invite", async () => {
    const admin = await signIn("admin");
    const { password: _p, ...rest } = NEW;
    const bad = [
      { ...NEW, isLdap: true }, // ldap + password
      { ...rest, isLdap: true, invite: true }, // ldap + invite
      rest, // neither
      { ...NEW, invite: true }, // both
    ];
    for (const b of bad) expect((await create(b, admin)).status).toBe(400);
    const ok = await create({ ...rest, isLdap: true }, admin);
    expect(ok.status).toBe(201);
    expect((await userRow(((await ok.json()) as { id: string }).id)).password_hash).toBeNull();
    expect((await create({ ...NEW, username: "u2", email: "u2@example.com", password: "short" }, admin)).status).toBe(400);
  });

  it("duplicate email or username is 409 duplicate (case-insensitive)", async () => {
    const admin = await signIn("admin");
    const a = await create({ ...NEW, email: "ADMIN@Example.com" }, admin);
    expect(a.status).toBe(409);
    expect(await code(a)).toBe("duplicate");
    const b = await create({ ...NEW, username: "SuperAdmin" }, admin);
    expect(b.status).toBe(409);
    expect(await code(b)).toBe("duplicate");
  });

  it("an unknown role name is 400", async () => {
    expect((await create({ ...NEW, roles: ["Nope"] }, await signIn("admin"))).status).toBe(400);
  });
});

describe("GET/PATCH /v1/users/{id}", () => {
  it("GET returns the user and the last 20 activity entries targeting them (sessions are their own list)", async () => {
    const admin = await signIn("admin");
    const target = await idOf("viewer");
    await addSession(target);
    const ids: string[] = [];
    for (let n = 0; n < 25; n++) {
      ids.push(Bun.randomUUIDv7());
      await db.insert(activity).values({
        id: ids[n]!, at: new Date(Date.UTC(2030, 0, 1, 0, n)), actorId: null, actorName: "X", action: "user.update", targetType: "user", targetId: target, targetLabel: "Viewer User",
      });
    }
    const body = (await (await getOne(target, admin)).json()) as UserDetailDto & { sessions?: unknown };
    expect(body.id).toBe(target);
    expect(body.sessions).toBeUndefined();
    expect(body.recentActivity).toHaveLength(20);
    expect(body.recentActivity![0]).toEqual({ id: ids[24]!, at: "2030-01-01T00:24:00.000Z", actor: { name: "X" }, action: "user.update" }); // no target, before, after
    expect(body.recentActivity!.every((a) => Object.keys(a).sort().join() === "action,actor,at,id")).toBe(true);
    expect(body.permissions).toEqual(expect.arrayContaining(["user.view"]));
    expect(body.permissions).not.toContain("user.edit");
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|totpSecret|recoveryCodes/);
    for (const id of ["nope", Bun.randomUUIDv7()]) {
      const r = await getOne(id, admin);
      expect(r.status).toBe(404);
      expect(await code(r)).toBe("not_found");
    }
    // connected providers come from user_identities
    expect(((await (await getOne(await idOf("google"), admin)).json()) as UserDto).connected).toEqual(["google"]);
  });

  it("GET omits recentActivity (null) without audit.view", async () => {
    await setPerms("Viewer", ["user.view"]);
    const body = (await (await getOne(await idOf("admin"), await signIn("viewer"))).json()) as UserDetailDto;
    expect(body.id).toBe(await idOf("admin"));
    expect(body.recentActivity).toBeNull();
  });

  it("PATCH roles of another user changes their permissions on their next request", async () => {
    const target = await idOf("viewer");
    const viewer = await signIn("viewer");
    expect((await create(NEW, viewer)).status).toBe(403);
    const r = await patch(target, { roles: ["Admin"] }, await signIn("admin"));
    expect(r.status).toBe(200);
    expect((await acts()).at(-1)).toMatchObject({ action: "user.update", targetId: target });
    expect((await create(NEW, viewer)).status).toBe(201);
  });

  it("PATCH validates role names, duplicates, and blocks changing own roles", async () => {
    const admin = await signIn("admin");
    const me = await idOf("admin");
    expect((await patch(await idOf("viewer"), { roles: ["Nope"] }, admin)).status).toBe(400);
    expect(await code(await patch(await idOf("viewer"), { email: "Superadmin@example.com" }, admin))).toBe("duplicate");
    const self = await patch(me, { roles: ["Viewer"] }, admin);
    expect(self.status).toBe(409);
    expect(await code(self)).toBe("self_action");
    expect((await patch(me, { name: "Renamed Admin" }, admin)).status).toBe(200);
  });

  it("the last active Superadmin can't lose the role, be deactivated or deleted; a second Superadmin frees it", async () => {
    // Actor rank means only someone holding every permission can act on a Superadmin. The seed Superadmin sets that
    // up through the API: a role with every permission for Admin User, and later a second Superadmin.
    const sa = await signIn("superadmin");
    expect((await call("POST", "/v1/roles", { token: sa, body: { name: "Operators", permissions: [...PERMISSIONS] } })).status).toBe(201);
    expect((await patch(await idOf("admin"), { roles: ["Admin", "Operators"] }, sa)).status).toBe(200);
    const admin = await signIn("admin");
    const sup = await idOf("superadmin");
    expect(await code(await patch(sup, { roles: ["Admin"] }, admin))).toBe("last_superadmin");
    expect(await code(await patch(sup, { isActive: false }, admin))).toBe("last_superadmin");
    expect(await code(await setStatus(sup, { active: false }, admin))).toBe("last_superadmin");
    expect(await code(await del(sup, admin))).toBe("last_superadmin");
    expect(await (await bulk({ action: "deactivate", ids: [sup] }, admin)).json()).toEqual({ done: [], skipped: [{ id: sup, code: "last_superadmin" }] });
    expect((await patch(await idOf("viewer"), { roles: ["Viewer", "Superadmin"] }, sa)).status).toBe(200);
    expect((await setStatus(sup, { active: false }, admin)).status).toBe(200);
  });

  it("deactivating through PATCH ends the user's sessions", async () => {
    const v = await idOf("viewer");
    const sess = await addSession(v);
    expect((await patch(v, { isActive: false }, await signIn("admin"))).status).toBe(200);
    expect(await hasSession(sess)).toBe(false);
  });

  it("a PATCH that was waiting on the user's row lock can't act on a user who now outranks the actor", async () => {
    // Admin holds what Viewer holds (user.view, audit.view) until audit.view is revoked from Admin while the PATCH,
    // already past the guard, waits for Viewer's row. Read before the lock (ctx.perms), the rank check would pass.
    const custom = await giveOnlyRole("admin", ["user.view", "user.edit", "audit.view"]);
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const holder = await holdTx((tx) => tx.select({ one: sql`1` }).from(users).where(eq(users.id, v)).for("update"));
    try {
      const pending = patch(v, { name: "Taken Over" }, admin);
      if (!(await lockWaiters(1, "%for update%"))) throw new Error("the PATCH never waited on the user's row lock");
      await holder.commit((tx) => tx.delete(rolePermissions).where(and(eq(rolePermissions.roleId, custom), eq(rolePermissions.permission, "audit.view"))));
      const r = await pending;
      expect(r.status).toBe(403);
      expect(await code(r)).toBe("forbidden");
    } finally {
      await holder.rollback().catch(() => {});
    }
    expect((await userRow(v)).name).toBe("Viewer User");
    expect(await acts()).toHaveLength(0);
  });
});

describe("lock order: users rows → roles for share → actor permissions → Superadmin lock", () => {
  it("a PATCH that was waiting on a role's share lock reads the actor's permissions after it (actor rank)", async () => {
    // The PATCH names the actor's own role "Custom"; a role edit holding that row revokes audit.view from it. Read before
    // the role lock, the actor would still hold audit.view and outrank Viewer.
    const custom = await giveOnlyRole("admin", ["user.view", "user.edit", "audit.view"]);
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const holder = await holdTx((tx) => tx.select({ one: sql`1` }).from(roles).where(eq(roles.id, custom)).for("update"));
    try {
      const pending = patch(v, { roles: ["Viewer", "Custom"] }, admin);
      if (!(await lockWaiters(1, "%roles%"))) throw new Error("the PATCH never waited on the role");
      await holder.commit((tx) => tx.delete(rolePermissions).where(and(eq(rolePermissions.roleId, custom), eq(rolePermissions.permission, "audit.view"))));
      const r = await pending;
      expect(r.status).toBe(403);
      expect(await code(r)).toBe("forbidden");
    } finally {
      await holder.rollback().catch(() => {});
    }
    expect(await rolesOf(v)).toEqual(["Viewer"]);
    expect(await acts()).toHaveLength(0);
  });
});

describe("DELETE and status", () => {
  it("DELETE needs user.delete, protects self and the last superadmin, removes sessions", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const sess = await addSession(v);
    expect(await code(await del(await idOf("admin"), admin))).toBe("self_action");
    expect(await code(await del(await idOf("superadmin"), admin))).toBe("forbidden"); // actor rank
    expect((await del(v, admin)).status).toBe(200);
    expect(await userRow(v)).toBeUndefined();
    expect(await hasSession(sess)).toBe(false);
    expect((await acts()).at(-1)).toMatchObject({ action: "user.delete", targetId: v });
    expect((await del(v, admin)).status).toBe(404);
    expect((await del(await idOf("apple"), await signIn("google"))).status).toBe(403);
  });

  it("deleting cascades to sessions, identities and links; activity keeps the deleted actor's name", async () => {
    const sa = await signIn("superadmin");
    const google = await idOf("google");
    expect((await patch(google, { roles: ["Viewer", "Admin"] }, sa)).status).toBe(200);
    expect((await patch(await idOf("apple"), { name: "Apple Renamed" }, await signIn("google"))).status).toBe(200);
    await addToken(google, "g-link");
    expect((await del(google, sa)).status).toBe(200);
    for (const table of [sessions, userIdentities, userTokens, userRoles]) {
      expect(await db.$count(table, eq(table.userId, google))).toBe(0);
    }
    const a = await acts();
    expect(a.find((x) => x.action === "user.update" && x.targetLabel === "Apple Renamed")).toMatchObject({ actorName: "Google User" });
    expect(a.at(-1)).toMatchObject({ action: "user.delete", targetLabel: "Google User", before: { id: google, username: "google", roles: ["Admin", "Viewer"] } });
  });

  it("status toggles, validates the body, and deactivation ends sessions", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const sess = await addSession(v);
    expect((await setStatus(v, { active: "no" }, admin)).status).toBe(400);
    const r = await setStatus(v, { active: false }, admin);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ isActive: false });
    expect(await hasSession(sess)).toBe(false);
    expect((await acts()).at(-1)).toMatchObject({ action: "user.deactivate" });
    expect((await setStatus(v, { active: true }, admin)).status).toBe(200);
    expect((await acts()).at(-1)).toMatchObject({ action: "user.activate" });
    expect(await code(await setStatus(await idOf("admin"), { active: false }, admin))).toBe("self_action");
  });

  it("concurrent last superadmin", async () => {
    // A and B are the only active Superadmins; A deactivates B while B deactivates A. A held advisory lock lets both
    // requests pass the guard and lock their target's row before either counts the Superadmins.
    const a = await idOf("superadmin");
    const b = await idOf("viewer");
    await db.insert(userRoles).values({ userId: b, roleId: await roleIdOf("Superadmin") });
    const [ta, tb] = [await signIn("superadmin"), await signIn("viewer")];
    const holder = await holdTx((tx) => xactLock(tx, "superadmin"));
    let waited = false;
    let rs: Response[];
    try {
      const both = Promise.all([setStatus(b, { active: false }, ta), setStatus(a, { active: false }, tb)]);
      waited = await lockWaiters(2, "%pg_advisory_xact_lock%");
      await holder.commit();
      rs = await both;
    } finally {
      await holder.rollback();
    }
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await code(rs.find((r) => r.status === 409)!)).toBe("last_superadmin");
    const n = await activeSupers();
    expect(n).toBe(1);
    expect(waited).toBe(true);
  });
});

describe("POST /v1/users/bulk", () => {
  it("0 or 101 ids, a missing role for assignRole, or an unknown action is 400", async () => {
    const admin = await signIn("admin");
    expect((await bulk({ action: "activate", ids: [] }, admin)).status).toBe(400);
    expect((await bulk({ action: "activate", ids: Array.from({ length: 101 }, (_, i) => `u-${i}`) }, admin)).status).toBe(400);
    expect((await bulk({ action: "assignRole", ids: ["u-003"] }, admin)).status).toBe(400);
    expect((await bulk({ action: "explode", ids: ["u-003"] }, admin)).status).toBe(400);
  });

  it("bulk deactivate with self and a Superadmin skips both with codes, logs only done ids", async () => {
    const admin = await signIn("admin");
    const me = await idOf("admin");
    const viewer = await idOf("viewer");
    const sess = await addSession(viewer);
    const sup = await idOf("superadmin");
    const r = await bulk({ action: "deactivate", ids: [me, sup, viewer] }, admin);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ done: [viewer], skipped: [{ id: me, code: "self_action" }, { id: sup, code: "forbidden" }] });
    expect((await userRow(me)).is_active).toBe(true);
    expect((await userRow(sup)).is_active).toBe(true);
    expect((await userRow(viewer)).is_active).toBe(false);
    expect(await hasSession(sess)).toBe(false);
    const added = await acts();
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ targetId: viewer });
  });

  it("unknown ids are skipped not_found; assignRole adds a role once and validates it", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const ghost = Bun.randomUUIDv7();
    const r = await bulk({ action: "assignRole", ids: [v, "ghost", ghost], role: "Admin" }, admin);
    expect(await r.json()).toEqual({ done: [v], skipped: [{ id: "ghost", code: "not_found" }, { id: ghost, code: "not_found" }] });
    expect(await rolesOf(v)).toEqual(["Admin", "Viewer"]);
    expect((await acts()).map((a) => [a.action, a.targetId, a.before, a.after])).toEqual([["user.assign_role", v, { roles: ["Viewer"] }, { roles: ["Admin", "Viewer"] }]]);
    // already held: done, unchanged, and nothing to log
    expect(await (await bulk({ action: "assignRole", ids: [v], role: "Admin" }, admin)).json()).toEqual({ done: [v], skipped: [] });
    expect(await rolesOf(v)).toEqual(["Admin", "Viewer"]);
    expect(await acts()).toHaveLength(1);
    expect((await bulk({ action: "assignRole", ids: [v], role: "Nope" }, admin)).status).toBe(400);
  });

  it("delete needs user.delete, the other actions user.edit", async () => {
    await setPerms("Viewer", ["user.view", "user.edit"]);
    const viewer = await signIn("viewer");
    const apple = await idOf("apple");
    expect((await bulk({ action: "delete", ids: [apple] }, viewer)).status).toBe(403);
    expect(await userRow(apple)).toBeDefined();
    expect((await bulk({ action: "deactivate", ids: [apple] }, viewer)).status).toBe(200);
  });

  it("bulk deactivate of every Superadmin leaves one active: self_action for the actor, last_superadmin for the last", async () => {
    const superRole = await roleIdOf("Superadmin");
    const [a, b, c] = [await idOf("superadmin"), await idOf("viewer"), await idOf("apple")];
    await db.insert(userRoles).values([{ userId: b, roleId: superRole }, { userId: c, roleId: superRole }]);
    // A (a Superadmin) on A, B and C: A is skipped as self, so A stays and B and C go
    expect(await (await bulk({ action: "deactivate", ids: [a, b, c] }, await signIn("superadmin"))).json()).toEqual({ done: [b, c], skipped: [{ id: a, code: "self_action" }] });
    expect(await activeSupers()).toBe(1);
    // an actor holding every permission without being a Superadmin: the second of the last two is refused
    await db.update(users).set({ isActive: true }).where(inArray(users.id, [b, c]));
    await giveOnlyRole("admin", [...PERMISSIONS]);
    const r = await bulk({ action: "deactivate", ids: [a, b, c] }, await signIn("admin"));
    expect(await r.json()).toEqual({ done: [a, b], skipped: [{ id: c, code: "last_superadmin" }] });
    expect(await activeSupers()).toBe(1);
  });

  it("filter instead of ids: acts on every user the list's search and filters match; ids and filter together, neither, or a bad filter is 400", async () => {
    const admin = await signIn("admin");
    const apple = await idOf("apple");
    expect((await bulk({ action: "activate" }, admin)).status).toBe(400);
    expect((await bulk({ action: "activate", ids: [apple], filter: {} }, admin)).status).toBe(400);
    expect((await bulk({ action: "activate", filter: { status: "nope" } }, admin)).status).toBe(400);
    expect((await bulk({ action: "activate", filter: { page: 2 } }, admin)).status).toBe(400);
    expect(await (await bulk({ action: "deactivate", filter: { q: "apple" } }, admin)).json()).toEqual({ done: [apple], skipped: [] });
    expect((await userRow(apple)).is_active).toBe(false);
    const inactive = await rows(db.select({ id: users.id }).from(users).where(eq(users.isActive, false)));
    const r = (await (await bulk({ action: "activate", filter: { status: "inactive" } }, admin)).json()) as { done: string[] };
    expect(r.done.toSorted()).toEqual(inactive.map((u) => u.id).toSorted());
    expect((await userRow(apple)).is_active).toBe(true);
    // a role filter, the same rules per user as with ids: the actor is skipped as self
    const me = await idOf("admin");
    expect(await (await bulk({ action: "deactivate", filter: { role: "Admin" } }, admin)).json()).toMatchObject({ skipped: expect.arrayContaining([{ id: me, code: "self_action" }]) });
  });

  it("filter matching more than BULK_ALL_MAX users is 400 and changes nothing", async () => {
    const admin = await signIn("admin");
    await db.insert(users).values(Array.from({ length: BULK_ALL_MAX + 1 }, (_, i) => ({ id: Bun.randomUUIDv7(), name: `Bulk ${i}`, username: `bulk${i}`, email: `bulk${i}@example.test` })));
    const inactive = async () => (await rows(db.select({ id: users.id }).from(users).where(eq(users.isActive, false)))).length;
    const before = await inactive();
    const r = await bulk({ action: "deactivate", filter: { q: "bulk" } }, admin);
    expect(r.status).toBe(400);
    expect(await code(r)).toBe("bad_request");
    expect(await inactive()).toBe(before);
    expect(await acts()).toHaveLength(0);
  });

  it("bulk delete removes sessions of deleted users and logs only done ids", async () => {
    const admin = await signIn("admin");
    const me = await idOf("admin");
    const v = await idOf("apple");
    const sess = await addSession(v);
    const r = await bulk({ action: "delete", ids: [me, v] }, admin);
    expect(await r.json()).toEqual({ done: [v], skipped: [{ id: me, code: "self_action" }] });
    expect(await hasSession(sess)).toBe(false);
    expect(await acts()).toHaveLength(1);
  });
});

describe("reset password and sessions", () => {
  it("returns a temporary password once, sets it, ends the user's sessions", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const sess = await addSession(v);
    await addToken(v, "old-link");
    const r = await resetPassword(v, admin);
    expect(r.status).toBe(200);
    const { temporaryPassword } = (await r.json()) as { temporaryPassword: string };
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);
    const hash = (await userRow(v)).password_hash;
    expect(await verifyPassword(temporaryPassword, hash)).toBe(true);
    expect(await verifyPassword(SEED_PASSWORD, hash)).toBe(false);
    expect(await hasSession(sess)).toBe(false);
    expect(JSON.stringify(await acts())).not.toContain(temporaryPassword);
    expect((await db.select({ one: sql`1` }).from(userTokens).where(eq(userTokens.userId, v))).length).toBe(0);
    expect((await acts()).at(-1)).toMatchObject({ action: "user.reset_password", targetId: v, before: null, after: null });
  });

  it("LDAP user is 409 ldap_password; own account is 409 self_action; viewer is 403", async () => {
    const admin = await signIn("admin");
    expect(await code(await resetPassword(await idOf("ldap"), admin))).toBe("ldap_password");
    expect(await code(await resetPassword(await idOf("admin"), admin))).toBe("self_action");
    expect((await resetPassword(await idOf("apple"), await signIn("viewer"))).status).toBe(403);
  });

  it("GET sessions: user.view, a page of that user's sessions newest first, current one marked, 404 for an unknown user", async () => {
    const v = await idOf("viewer");
    expect((await sessionsOf(v)).status).toBe(401);
    expect((await sessionsOf(v, "pageSize=10")).status).toBe(400); // before the guard
    const viewer = await signIn("viewer");
    const sid = await sidOf(viewer);
    const older = await addSession(v);
    await db.update(sessions).set({ lastSeenAt: sql`now() - interval '60 minutes'` }).where(eq(sessions.id, older));
    // ended sessions are not listed: expired, and idle past SESSION_IDLE_MINUTES
    const expired = await addSession(v);
    await db.update(sessions).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(sessions.id, expired));
    const idle = await addSession(v);
    await db.update(sessions).set({ lastSeenAt: sql`now() - interval '1 day'` }).where(eq(sessions.id, idle));
    await addSession(await idOf("apple"));
    const page = (await (await sessionsOf(v, "", viewer)).json()) as Page<{ id: string; current: boolean }>;
    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 15 });
    expect(page.items.map((x) => [x.id, x.current])).toEqual([[sid, true], [older, false]]);
    expect((await sessionsOf("nope", "", viewer)).status).toBe(404);
    expect((await sessionsOf(Bun.randomUUIDv7(), "", viewer)).status).toBe(404);
    await setPerms("Viewer", []);
    expect((await sessionsOf(v, "", viewer)).status).toBe(403);
  });

  it("DELETE session ends another user's session; a session of someone else or an unknown one is 404", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const sess = await addSession(v);
    const other = await addSession(await idOf("apple"));
    expect((await endSession(v, other, admin)).status).toBe(404);
    expect(await hasSession(other)).toBe(true);
    expect((await endSession(v, sess, admin)).status).toBe(200);
    expect(await hasSession(sess)).toBe(false);
    expect((await acts()).at(-1)).toMatchObject({ action: "user.session_end", targetId: v, after: { session: "Unknown device" } });
    expect((await endSession(v, "nope", admin)).status).toBe(404);
    expect((await endSession(v, Bun.randomUUIDv7(), admin)).status).toBe(404);
  });

  it("DELETE session of an ended session (expired or idle) is 404 and writes nothing", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const expired = await addSession(v);
    await db.update(sessions).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(sessions.id, expired));
    const idle = await addSession(v);
    await db.update(sessions).set({ lastSeenAt: sql`now() - interval '1 day'` }).where(eq(sessions.id, idle));
    for (const sid of [expired, idle]) {
      const r = await endSession(v, sid, admin);
      expect(r.status).toBe(404);
      expect(await code(r)).toBe("not_found");
    }
    expect(await acts()).toHaveLength(0);
  });

  it("DELETE session refuses the actor's own session and a wrong csrf token", async () => {
    // The csrf half is the web's (Task 9); the API part is the actor's own session.
    const admin = await signIn("admin");
    expect(await code(await endSession(await idOf("admin"), await sidOf(admin), admin))).toBe("self_action");
  });
});

describe("role grants (no privilege escalation)", () => {
  it("Admin cannot grant or remove Superadmin on create, PATCH or bulk; can grant Viewer", async () => {
    const admin = await signIn("admin");
    expect((await create({ ...NEW, roles: ["Superadmin"] }, admin)).status).toBe(403);
    expect(await userCount()).toBe(50);
    const v = await idOf("viewer");
    const p = await patch(v, { roles: ["Viewer", "Superadmin"] }, admin);
    expect(p.status).toBe(403);
    expect(await code(p)).toBe("forbidden");
    expect(await rolesOf(v)).toEqual(["Viewer"]);
    // removing Superadmin from someone is also refused
    await setRoles("viewer", ["Superadmin", "Viewer"]);
    expect((await patch(v, { roles: ["Viewer"] }, admin)).status).toBe(403);
    await setRoles("viewer", ["Viewer"]);
    const r = await bulk({ action: "assignRole", ids: [v], role: "Superadmin" }, admin);
    expect(await r.json()).toEqual({ done: [], skipped: [{ id: v, code: "forbidden" }] });
    expect(await acts()).toHaveLength(0);
    expect((await patch(v, { roles: ["Viewer", "Viewer"] }, admin)).status).toBe(200); // unchanged set, no grant
    expect((await create({ ...NEW, roles: ["Viewer"] }, admin)).status).toBe(201);
    expect((await bulk({ action: "assignRole", ids: [await idOf("apple")], role: "Viewer" }, admin)).status).toBe(200);
  });

  it("a role deleted while the PATCH waits for it is an unknown role (400), not a 500", async () => {
    const sa = await signIn("superadmin");
    const temp = Bun.randomUUIDv7();
    await db.insert(roles).values({ id: temp, name: "Temp" });
    const v = await idOf("viewer");
    const holder = await holdTx((tx) => tx.delete(roles).where(eq(roles.id, temp))); // a role DELETE that hasn't committed yet
    try {
      const pending = patch(v, { roles: ["Viewer", "Temp"] }, sa);
      if (!(await lockWaiters(1, "%roles%"))) throw new Error("the PATCH never waited on the role");
      await holder.commit();
      const r = await pending;
      expect(r.status).toBe(400);
      expect(await code(r)).toBe("bad_request");
    } finally {
      await holder.rollback().catch(() => {});
    }
    expect(await rolesOf(v)).toEqual(["Viewer"]);
    expect(await acts()).toHaveLength(0);
  });

  it("Superadmin can grant Superadmin", async () => {
    const sa = await signIn("superadmin");
    const v = await idOf("viewer");
    expect((await patch(v, { roles: ["Viewer", "Superadmin"] }, sa)).status).toBe(200);
    expect(await rolesOf(v)).toContain("Superadmin");
    expect((await create({ ...NEW, roles: ["Superadmin"] }, sa)).status).toBe(201);
  });

  it("bulk assignRole with self in ids skips self with self_action", async () => {
    const sa = await signIn("superadmin");
    const me = await idOf("superadmin");
    const v = await idOf("viewer");
    const r = await bulk({ action: "assignRole", ids: [me, v], role: "Admin" }, sa);
    expect(await r.json()).toEqual({ done: [v], skipped: [{ id: me, code: "self_action" }] });
    expect(await rolesOf(me)).toEqual(["Superadmin"]);
  });
});

describe("seed as shipped", () => {
  it("Admin can grant Viewer (its permissions are a subset of Admin's)", async () => {
    expect((await create(NEW, await signIn("admin"))).status).toBe(201);
  });
});

describe("actor rank: no acting on a user who holds a permission the actor lacks", () => {
  it("Admin cannot reset, edit, deactivate, delete or end sessions of Superadmin", async () => {
    const admin = await signIn("admin");
    const sup = await idOf("superadmin");
    const sess = await addSession(sup);
    const snapshot = [await userRow(sup), await rolesOf(sup)];
    const answers = [
      await resetPassword(sup, admin),
      await patch(sup, { email: "taken-over@example.com" }, admin),
      await patch(sup, { name: "Renamed" }, admin),
      await patch(sup, { isActive: false }, admin),
      await setStatus(sup, { active: false }, admin),
      await del(sup, admin),
      await endSession(sup, sess, admin),
    ];
    for (const r of answers) {
      expect(r.status).toBe(403);
      expect(await code(r)).toBe("forbidden");
    }
    expect([await userRow(sup), await rolesOf(sup)]).toEqual(snapshot);
    expect(await hasSession(sess)).toBe(true);
    expect(await acts()).toHaveLength(0);
  });

  it("Admin cannot activate an inactive Superadmin", async () => {
    const extra = Bun.randomUUIDv7();
    await db.insert(users).values({ id: extra, name: "Second Super", username: "sa2", email: "sa2@example.com", isActive: false });
    await db.insert(userRoles).values({ userId: extra, roleId: await roleIdOf("Superadmin") });
    expect(await code(await setStatus(extra, { active: true }, await signIn("admin")))).toBe("forbidden");
    expect((await userRow(extra)).is_active).toBe(false);
  });

  it("bulk skips a Superadmin with forbidden for every action and logs nothing for it", async () => {
    const admin = await signIn("admin");
    const sup = await idOf("superadmin");
    for (const body of [{ action: "activate" }, { action: "deactivate" }, { action: "delete" }, { action: "assignRole", role: "Viewer" }]) {
      const r = await bulk({ ...body, ids: [sup] }, admin);
      expect(await r.json()).toEqual({ done: [], skipped: [{ id: sup, code: "forbidden" }] });
    }
    expect((await userRow(sup)).is_active).toBe(true);
    expect(await rolesOf(sup)).toEqual(["Superadmin"]);
    expect(await acts()).toHaveLength(0);
  });

  it("an equal or lower rank is allowed: Admin acts on another Admin and on a Viewer", async () => {
    const admin = await signIn("admin");
    expect((await resetPassword(await idOf("twofa"), admin)).status).toBe(200);
    expect((await patch(await idOf("viewer"), { name: "Renamed Viewer" }, admin)).status).toBe(200);
    expect((await setStatus(await idOf("twofa"), { active: false }, admin)).status).toBe(200);
  });

  it("an extra role outranks: Admin can't act on another Admin who also holds role.view", async () => {
    const sa = await signIn("superadmin");
    expect((await call("POST", "/v1/roles", { token: sa, body: { name: "Auditors", permissions: ["audit.view", "role.view"] } })).status).toBe(201);
    expect((await patch(await idOf("twofa"), { roles: ["Admin", "Auditors"] }, sa)).status).toBe(200);
    expect(await code(await resetPassword(await idOf("twofa"), await signIn("admin")))).toBe("forbidden");
  });
});

describe("roles are referenced by name, case-insensitively, stored in their canonical casing", () => {
  it("create, PATCH, filter and bulk accept any letter case and store the role's own name", async () => {
    const sa = await signIn("superadmin");
    const r = await create({ ...NEW, roles: ["viewer", "VIEWER"] }, sa);
    expect(r.status).toBe(201);
    expect(((await r.json()) as UserDto).roles).toEqual(["Viewer"]);
    const v = await idOf("viewer");
    expect((await patch(v, { roles: ["viewer", "aDmIn"] }, sa)).status).toBe(200);
    expect(await rolesOf(v)).toEqual(["Admin", "Viewer"]);
    expect(await total(await get("?role=superADMIN", sa))).toBe(1);
    const apple = await idOf("apple");
    expect(await (await bulk({ action: "assignRole", ids: [apple], role: "admin" }, sa)).json()).toEqual({ done: [apple], skipped: [] });
    expect(await rolesOf(apple)).toEqual(["Admin", "Viewer"]);
  });

  it("a stale name (the role was renamed) is 400", async () => {
    const sa = await signIn("superadmin");
    await db.update(roles).set({ name: "Reader" }).where(eq(roles.name, "Viewer"));
    expect((await create({ ...NEW, roles: ["Viewer"] }, sa)).status).toBe(400);
    expect((await bulk({ action: "assignRole", ids: [await idOf("apple")], role: "Viewer" }, sa)).status).toBe(400);
  });
});

describe("one deactivate path: PATCH isActive and POST /status", () => {
  it("PATCH isActive logs user.deactivate / user.activate like /status; other fields log user.update", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    expect((await patch(v, { isActive: false }, admin)).status).toBe(200);
    expect((await setStatus(v, { active: true }, admin)).status).toBe(200);
    expect((await patch(v, { name: "Renamed Viewer", isActive: false }, admin)).status).toBe(200);
    expect((await acts()).filter((a) => a.targetId === v).map((a) => [a.action, a.before, a.after])).toEqual([
      ["user.deactivate", { isActive: true }, { isActive: false }],
      ["user.activate", { isActive: false }, { isActive: true }],
      ["user.update", { name: "Viewer User" }, { name: "Renamed Viewer" }],
      ["user.deactivate", { isActive: true }, { isActive: false }],
    ]);
  });

  it("deactivating (PATCH, /status, bulk) and an email change spend the user's reset and invitation links", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const links = async () => (await db.select({ one: sql`1` }).from(userTokens).where(eq(userTokens.userId, v))).length;
    const relink = async (t: string) => {
      expect((await setStatus(v, { active: true }, admin)).status).toBe(200);
      await addToken(v, t);
    };
    await addToken(v, "link-1");
    expect((await patch(v, { isActive: false }, admin)).status).toBe(200);
    expect(await links()).toBe(0);
    await relink("link-2");
    expect((await setStatus(v, { active: false }, admin)).status).toBe(200);
    expect(await links()).toBe(0);
    await relink("link-3");
    expect((await bulk({ action: "deactivate", ids: [v] }, admin)).status).toBe(200);
    expect(await links()).toBe(0);
    await relink("link-4");
    expect((await patch(v, { name: "Renamed Viewer" }, admin)).status).toBe(200);
    expect(await links()).toBe(1); // a name change keeps the link
    expect((await patch(v, { email: "viewer.new@example.com" }, admin)).status).toBe(200);
    expect(await links()).toBe(0);
  });

  it("a PATCH that changes nothing is 200 and writes no activity", async () => {
    const admin = await signIn("admin");
    const v = await idOf("viewer");
    const before = await userRow(v);
    for (const b of [{}, { name: "Viewer User" }, { email: "viewer@example.com", username: "viewer" }, { roles: ["viewer"], isActive: true }]) {
      expect((await patch(v, b, admin)).status).toBe(200);
    }
    expect(await acts()).toHaveLength(0);
    expect(await userRow(v)).toEqual(before);
  });
});

describe("order: parse (400) → guard → existence (404) → rules", () => {
  it("a bad body for an unknown user is 400, not 404", async () => {
    const sa = await signIn("superadmin");
    expect((await patch("ghost", { email: "nope" }, sa)).status).toBe(400);
    expect((await setStatus("ghost", { active: "no" }, sa)).status).toBe(400);
  });

  it("bulk with a bad body: no session is 401, then the permission a bad body needs (user.edit) is 403, before the 400", async () => {
    const bad = { action: "explode", ids: [] };
    expect((await bulk(bad, "no-such-session")).status).toBe(401);
    expect((await call("POST", "/v1/users/bulk", { body: bad })).status).toBe(401);
    expect((await bulk(bad, await signIn("viewer"))).status).toBe(403);
    await giveOnlyRole("admin", ["user.view", "user.delete"]);
    expect((await bulk(bad, await signIn("admin"))).status).toBe(403);
    expect((await bulk(bad, await signIn("superadmin"))).status).toBe(400);
  });
});

describe("bulk assignRole respects the 20-role cap", () => {
  it("a user who already has 20 roles is skipped with bad_request", async () => {
    const sa = await signIn("superadmin");
    const v = await idOf("viewer");
    const names = Array.from({ length: 19 }, (_, i) => `Team ${i}`);
    await db.insert(roles).values(names.map((name) => ({ id: Bun.randomUUIDv7(), name })));
    await setRoles("viewer", ["Viewer", ...names]);
    const apple = await idOf("apple");
    const r = await bulk({ action: "assignRole", ids: [v, apple], role: "Admin" }, sa);
    expect(await r.json()).toEqual({ done: [apple], skipped: [{ id: v, code: "bad_request" }] });
    expect(await rolesOf(v)).toHaveLength(20);
  });
});

describe("ending a session that is the actor's own", () => {
  it("answers the same self_action message as /api/me/sessions/[id]", async () => {
    const admin = await signIn("admin");
    const r = await endSession(await idOf("admin"), await sidOf(admin), admin);
    expect(await r.json()).toEqual({ error: { code: "self_action", message: "This is the session you're using. Sign out instead." } });
  });
});
