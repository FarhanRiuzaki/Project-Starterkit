import { randomUUID } from "node:crypto";
import { sealData } from "iron-session";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import { db, resetDb } from "@/lib/server/mock/db";
import { hashToken, verifyPassword } from "@/lib/server/mock/password";
import { SEED_PASSWORD } from "@/lib/server/mock/seed";
import { SESSION_COOKIE } from "@/lib/server/session";
import { POST as resetPost } from "../auth/reset/route";
import { DELETE as userDelete, GET as userGet, PATCH as userPatch } from "./[id]/route";
import { POST as resetPassword } from "./[id]/reset-password/route";
import { DELETE as sessionDelete } from "./[id]/sessions/[sid]/route";
import { POST as statusPost } from "./[id]/status/route";
import { POST as bulkPost } from "./bulk/route";
import { GET as rolesGet } from "./roles/route";
import { GET as listGet, POST as createPost } from "./route";

const CSRF = "c".repeat(43);

async function signIn(username: string) {
  const user = [...db().users.values()].find((u) => u.username === username)!;
  const sid = randomUUID();
  const now = new Date().toISOString();
  db().sessions.set(sid, { id: sid, userId: user.id, method: "password", device: "test", ip: "test", createdAt: now, lastSeenAt: now });
  jar.set(SESSION_COOKIE, await sealData({ sid, csrf: CSRF }, { password: SECRET, ttl: 3600 }));
  return { user, sid };
}
const idOf = (username: string) => [...db().users.values()].find((u) => u.username === username)!.id;
const addSession = (userId: string) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  db().sessions.set(id, { id, userId, method: "password", device: "other", ip: "1.1.1.1", createdAt: now, lastSeenAt: now });
  return id;
};

const req = (method: string, body?: unknown, url = "http://c/api/users", csrf = CSRF) =>
  new Request(url, { method, headers: { "content-type": "application/json", "x-csrf-token": csrf, origin: "http://c" }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = (qs = "") => listGet(req("GET", undefined, `http://c/api/users${qs}`));
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
const acts = () => [...db().activity.values()];
const NEW = { name: "New Person", username: "new.person", email: "new.person@example.com", roles: ["Viewer"], isActive: true, isLdap: false, password: "Brand-New-Pass-1!" };
const bulk = (body: unknown) => bulkPost(req("POST", body, "http://c/api/users/bulk"));

beforeEach(() => {
  resetDb();
  jar.clear();
});

describe("GET /api/users", () => {
  it.each([["page=0"], ["pageSize=7"], ["sort=password"], ["status=deleted"]])("rejects %s with 400 before guard", async (qs) => {
    // no session at all: a 401 here would mean the guard ran first
    expect((await get(`?${qs}`)).status).toBe(400);
    await signIn("viewer");
    expect((await get(`?${qs}`)).status).toBe(400);
  });

  it("needs a session and user.view", async () => {
    expect((await get()).status).toBe(401);
    await signIn("viewer");
    expect((await get()).status).toBe(200);
    db().roles.get("role-viewer")!.permissions = [];
    expect((await get()).status).toBe(403);
  });

  it("pages, sorts and filters; never returns secrets", async () => {
    await signIn("admin");
    const r = await get("?pageSize=10&page=2&sort=-name");
    const body = (await r.json()) as { items: { name: string }[]; total: number; page: number; pageSize: number };
    expect(body).toMatchObject({ total: 50, page: 2, pageSize: 10 });
    expect(body.items).toHaveLength(10);
    const names = body.items.map((u) => u.name);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|totpSecret|recoveryCodes/);
    const inactive = (await (await get("?status=inactive&pageSize=100")).json()) as { items: { isActive: boolean }[] };
    expect(inactive.items.length).toBeGreaterThan(0);
    expect(inactive.items.every((u) => !u.isActive)).toBe(true);
    const supers = (await (await get("?role=Superadmin")).json()) as { total: number };
    expect(supers.total).toBe(1);
  });

  it("q matches name, username, email case-insensitively", async () => {
    await signIn("admin");
    const total = async (q: string) => ((await (await get(`?q=${encodeURIComponent(q)}`)).json()) as { total: number }).total;
    expect(await total("DIRECTORY USER")).toBe(1);
    expect(await total("GOOGLE")).toBe(1);
    expect(await total("apple@EXAMPLE.com")).toBe(1);
    expect(await total("zzz-no-match")).toBe(0);
  });
});

describe("GET /api/users/roles", () => {
  it("lists role names with user.view and needs a session", async () => {
    expect((await rolesGet(req("GET"))).status).toBe(401);
    await signIn("viewer");
    expect(await (await rolesGet(req("GET"))).json()).toEqual(["Superadmin", "Admin", "Viewer"]);
    db().roles.get("role-viewer")!.permissions = [];
    expect((await rolesGet(req("GET"))).status).toBe(403);
  });
});

describe("POST /api/users", () => {
  it("viewer gets 403 and the store is unchanged", async () => {
    await signIn("viewer");
    const before = db().users.size;
    const acts0 = acts().length;
    const r = await createPost(req("POST", NEW));
    expect(r.status).toBe(403);
    expect(db().users.size).toBe(before);
    expect(acts().length).toBe(acts0);
  });

  it("creates a user with a password: hashed, DTO without secrets, one activity entry", async () => {
    await signIn("admin");
    const r = await createPost(req("POST", NEW));
    expect(r.status).toBe(201);
    const dto = await r.json();
    expect(dto).toMatchObject({ username: "new.person", roles: ["Viewer"], isActive: true, isLdap: false });
    expect(JSON.stringify(dto)).not.toMatch(/passwordHash|Brand-New/);
    const rec = db().users.get(dto.id)!;
    expect(verifyPassword(NEW.password, rec.passwordHash!)).toBe(true);
    expect(acts().at(-1)).toMatchObject({ action: "user.create", target: { type: "user", id: dto.id } });
    expect(JSON.stringify(acts().at(-1))).not.toMatch(/Brand-New|passwordHash/);
  });

  it("invite: no password, a 72 h set-password token that /api/auth/reset accepts", async () => {
    await signIn("admin");
    const { password: _p, ...rest } = NEW;
    const r = await createPost(req("POST", { ...rest, invite: true }));
    expect(r.status).toBe(201);
    const id = ((await r.json()) as { id: string }).id;
    expect(db().users.get(id)!.passwordHash).toBeNull();
    const entries = [...db().resetTokens.entries()].filter(([, t]) => t.userId === id);
    expect(entries).toHaveLength(1);
    const [key, rec] = entries[0]!;
    expect(rec.expiresAt - Date.now()).toBeGreaterThan(71 * 3600_000);
    expect(rec.expiresAt - Date.now()).toBeLessThanOrEqual(72 * 3600_000);
    // The raw token is only in the log; swap in a known one to prove the reset route consumes the same store.
    db().resetTokens.delete(key);
    db().resetTokens.set(hashToken("known-token"), rec);
    const done = await resetPost(new Request("http://c/api/auth/reset", { method: "POST", headers: { "content-type": "application/json", origin: "http://c" }, body: JSON.stringify({ token: "known-token", password: "Chosen-Pass-123!" }) }));
    expect(done.status).toBe(200);
    expect(verifyPassword("Chosen-Pass-123!", db().users.get(id)!.passwordHash!)).toBe(true);
  });

  it("LDAP user with password or invite is 400; non-LDAP needs exactly one of password / invite", async () => {
    await signIn("admin");
    const { password: _p, ...rest } = NEW;
    const bad = [
      { ...NEW, isLdap: true }, // ldap + password
      { ...rest, isLdap: true, invite: true }, // ldap + invite
      rest, // neither
      { ...NEW, invite: true }, // both
    ];
    for (const b of bad) expect((await createPost(req("POST", b))).status).toBe(400);
    const ok = await createPost(req("POST", { ...rest, isLdap: true }));
    expect(ok.status).toBe(201);
    expect(db().users.get(((await ok.json()) as { id: string }).id)!.passwordHash).toBeNull();
    expect((await createPost(req("POST", { ...NEW, username: "u2", email: "u2@example.com", password: "short" }))).status).toBe(400);
  });

  it("duplicate email or username is 409 duplicate (case-insensitive)", async () => {
    await signIn("admin");
    const a = await createPost(req("POST", { ...NEW, email: "ADMIN@Example.com" }));
    expect(a.status).toBe(409);
    expect(await code(a)).toBe("duplicate");
    const b = await createPost(req("POST", { ...NEW, username: "SuperAdmin" }));
    expect(b.status).toBe(409);
    expect(await code(b)).toBe("duplicate");
  });

  it("an unknown role name is 400", async () => {
    await signIn("admin");
    expect((await createPost(req("POST", { ...NEW, roles: ["Nope"] }))).status).toBe(400);
  });
});

describe("GET/PATCH /api/users/[id]", () => {
  it("GET returns the user with sessions and the last 20 activity entries targeting them", async () => {
    await signIn("admin");
    const target = idOf("viewer");
    addSession(target);
    const mk = (n: number) => db().activity.set(`a${n}`, { id: `a${n}`, at: new Date(Date.UTC(2030, 0, 1, 0, n)).toISOString(), actor: { id: "x", name: "X" }, action: "user.update", target: { type: "user", id: target, label: "Viewer User" }, before: null, after: null });
    for (let n = 0; n < 25; n++) mk(n);
    const r = await userGet(req("GET"), params(target));
    const body = (await r.json()) as { id: string; sessions: { device: string }[]; recentActivity: { id: string; action: string }[] | null };
    expect(body.id).toBe(target);
    expect(body.sessions).toHaveLength(1);
    expect(body.recentActivity).toHaveLength(20);
    expect(body.recentActivity![0]).toEqual({ id: "a24", at: expect.any(String), actor: { name: "X" }, action: "user.update" }); // no target, before, after
    expect(body.recentActivity!.every((a) => Object.keys(a).sort().join() === "action,actor,at,id")).toBe(true);
    expect((body as unknown as { permissions: string[] }).permissions).toEqual(expect.arrayContaining(["user.view"]));
    expect((body as unknown as { permissions: string[] }).permissions).not.toContain("user.edit");
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|totpSecret|recoveryCodes/);
    expect((await userGet(req("GET"), params("nope"))).status).toBe(404);
  });

  it("GET omits recentActivity (null) without audit.view", async () => {
    db().roles.get("role-viewer")!.permissions = ["user.view"];
    await signIn("viewer");
    const body = (await (await userGet(req("GET"), params(idOf("admin")))).json()) as { recentActivity: unknown; id: string };
    expect(body.id).toBe(idOf("admin"));
    expect(body.recentActivity).toBeNull();
  });

  it("PATCH roles of another user changes their permissions on their next request", async () => {
    const target = idOf("viewer");
    await signIn("viewer");
    expect((await createPost(req("POST", NEW))).status).toBe(403);
    const viewerJar = jar.get(SESSION_COOKIE)!;
    await signIn("admin");
    const r = await userPatch(req("PATCH", { roles: ["Admin"] }), params(target));
    expect(r.status).toBe(200);
    expect(acts().at(-1)).toMatchObject({ action: "user.update", target: { id: target } });
    jar.set(SESSION_COOKIE, viewerJar);
    expect((await createPost(req("POST", NEW))).status).toBe(201);
  });

  it("PATCH validates role names, duplicates, and blocks changing own roles", async () => {
    const { user } = await signIn("admin");
    expect((await userPatch(req("PATCH", { roles: ["Nope"] }), params(idOf("viewer")))).status).toBe(400);
    const dup = await userPatch(req("PATCH", { email: "Superadmin@example.com" }), params(idOf("viewer")));
    expect(await code(dup)).toBe("duplicate");
    const self = await userPatch(req("PATCH", { roles: ["Viewer"] }), params(user.id));
    expect(self.status).toBe(409);
    expect(await code(self)).toBe("self_action");
    expect((await userPatch(req("PATCH", { name: "Renamed Admin" }), params(user.id))).status).toBe(200);
  });

  it("PATCH removing Superadmin from the last one is 409 last_superadmin; deactivating ends sessions", async () => {
    db().roles.get("role-admin")!.permissions = ["user.view", "user.edit", "role.view", "role.create", "role.edit", "role.delete", "permission.view", "permission.create", "audit.view", "user.create", "user.delete"]; // all, so the grant rule passes
    await signIn("admin");
    const r = await userPatch(req("PATCH", { roles: ["Admin"] }), params(idOf("superadmin")));
    expect(await code(r)).toBe("last_superadmin");
    const v = idOf("viewer");
    const sess = addSession(v);
    expect((await userPatch(req("PATCH", { isActive: false }), params(v))).status).toBe(200);
    expect(db().sessions.has(sess)).toBe(false);
  });
});

describe("DELETE and status", () => {
  it("DELETE needs user.delete, protects self and the last superadmin, removes sessions", async () => {
    const { user } = await signIn("admin");
    const v = idOf("viewer");
    const sess = addSession(v);
    expect(await code(await userDelete(req("DELETE"), params(user.id)))).toBe("self_action");
    expect(await code(await userDelete(req("DELETE"), params(idOf("superadmin"))))).toBe("last_superadmin");
    expect((await userDelete(req("DELETE"), params(v))).status).toBe(200);
    expect(db().users.has(v)).toBe(false);
    expect(db().sessions.has(sess)).toBe(false);
    expect(acts().at(-1)).toMatchObject({ action: "user.delete", target: { id: v } });
    expect((await userDelete(req("DELETE"), params(v))).status).toBe(404);
    await signIn("google");
    expect((await userDelete(req("DELETE"), params(idOf("apple")))).status).toBe(403);
  });

  it("status toggles, validates the body, and deactivation ends sessions", async () => {
    await signIn("admin");
    const v = idOf("viewer");
    const sess = addSession(v);
    expect((await statusPost(req("POST", { active: "no" }), params(v))).status).toBe(400);
    const r = await statusPost(req("POST", { active: false }), params(v));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ isActive: false });
    expect(db().sessions.has(sess)).toBe(false);
    expect(acts().at(-1)).toMatchObject({ action: "user.deactivate" });
    expect((await statusPost(req("POST", { active: true }), params(v))).status).toBe(200);
    expect(acts().at(-1)).toMatchObject({ action: "user.activate" });
    expect(await code(await statusPost(req("POST", { active: false }), params(idOf("admin"))))).toBe("self_action");
  });
});

describe("POST /api/users/bulk", () => {
  it("0 or 101 ids, a missing role for assignRole, or an unknown action is 400", async () => {
    await signIn("admin");
    expect((await bulk({ action: "activate", ids: [] })).status).toBe(400);
    expect((await bulk({ action: "activate", ids: Array.from({ length: 101 }, (_, i) => `u-${i}`) })).status).toBe(400);
    expect((await bulk({ action: "assignRole", ids: ["u-003"] })).status).toBe(400);
    expect((await bulk({ action: "explode", ids: ["u-003"] })).status).toBe(400);
  });

  it("bulk deactivate with self and last superadmin skips both with codes, logs only done ids", async () => {
    const { user } = await signIn("admin");
    const viewer = idOf("viewer");
    const sess = addSession(viewer);
    const sup = idOf("superadmin");
    const before = acts().length;
    const r = await bulk({ action: "deactivate", ids: [user.id, sup, viewer] });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ done: [viewer], skipped: [{ id: user.id, code: "self_action" }, { id: sup, code: "last_superadmin" }] });
    expect(db().users.get(user.id)!.isActive).toBe(true);
    expect(db().users.get(sup)!.isActive).toBe(true);
    expect(db().users.get(viewer)!.isActive).toBe(false);
    expect(db().sessions.has(sess)).toBe(false);
    const added = acts().slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ target: { id: viewer } });
  });

  it("unknown ids are skipped not_found; assignRole adds a role once and validates it", async () => {
    await signIn("admin");
    const v = idOf("viewer");
    const r = await bulk({ action: "assignRole", ids: [v, "ghost"], role: "Admin" });
    expect(await r.json()).toEqual({ done: [v], skipped: [{ id: "ghost", code: "not_found" }] });
    expect(db().users.get(v)!.roles).toEqual(["Viewer", "Admin"]);
    await bulk({ action: "assignRole", ids: [v], role: "Admin" });
    expect(db().users.get(v)!.roles).toEqual(["Viewer", "Admin"]);
    expect((await bulk({ action: "assignRole", ids: [v], role: "Nope" })).status).toBe(400);
  });

  it("delete needs user.delete, the other actions user.edit", async () => {
    db().roles.get("role-viewer")!.permissions = ["user.view", "user.edit"];
    await signIn("viewer");
    expect((await bulk({ action: "delete", ids: [idOf("apple")] })).status).toBe(403);
    expect(db().users.has(idOf("apple"))).toBe(true);
    expect((await bulk({ action: "deactivate", ids: [idOf("apple")] })).status).toBe(200);
  });

  it("bulk delete removes sessions of deleted users and logs only done ids", async () => {
    const { user } = await signIn("admin");
    const v = idOf("apple");
    const sess = addSession(v);
    const before = acts().length;
    const r = await bulk({ action: "delete", ids: [user.id, v] });
    expect(await r.json()).toEqual({ done: [v], skipped: [{ id: user.id, code: "self_action" }] });
    expect(db().sessions.has(sess)).toBe(false);
    expect(acts().length).toBe(before + 1);
  });
});

describe("reset password and sessions", () => {
  it("returns a temporary password once, sets it, ends the user's sessions", async () => {
    await signIn("admin");
    const v = idOf("viewer");
    const sess = addSession(v);
    db().resetTokens.set(hashToken("old-link"), { userId: v, expiresAt: Date.now() + 3600_000 });
    const r = await resetPassword(req("POST"), params(v));
    expect(r.status).toBe(200);
    const { temporaryPassword } = (await r.json()) as { temporaryPassword: string };
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(verifyPassword(temporaryPassword, db().users.get(v)!.passwordHash!)).toBe(true);
    expect(verifyPassword(SEED_PASSWORD, db().users.get(v)!.passwordHash!)).toBe(false);
    expect(db().sessions.has(sess)).toBe(false);
    expect(JSON.stringify(acts().at(-1))).not.toContain(temporaryPassword);
    expect([...db().resetTokens.values()].some((t) => t.userId === v)).toBe(false);
    expect(acts().at(-1)).toMatchObject({ action: "user.reset_password", target: { id: v } });
  });

  it("LDAP user is 409 ldap_password; own account is 409 self_action; viewer is 403", async () => {
    const { user } = await signIn("admin");
    expect(await code(await resetPassword(req("POST"), params(idOf("ldap"))))).toBe("ldap_password");
    expect(await code(await resetPassword(req("POST"), params(user.id)))).toBe("self_action");
    await signIn("viewer");
    expect((await resetPassword(req("POST"), params(idOf("apple")))).status).toBe(403);
  });

  it("DELETE session ends another user's session; a session of someone else or an unknown one is 404", async () => {
    await signIn("admin");
    const v = idOf("viewer");
    const sess = addSession(v);
    const other = addSession(idOf("apple"));
    const del = (id: string, sid: string) => sessionDelete(req("DELETE"), { params: Promise.resolve({ id, sid }) });
    expect((await del(v, other)).status).toBe(404);
    expect(db().sessions.has(other)).toBe(true);
    expect((await del(v, sess)).status).toBe(200);
    expect(db().sessions.has(sess)).toBe(false);
    expect(acts().at(-1)).toMatchObject({ action: "user.session_end", target: { id: v } });
    expect((await del(v, "nope")).status).toBe(404);
  });

  it("DELETE session refuses the actor's own session and a wrong csrf token", async () => {
    const { user, sid } = await signIn("admin");
    const r = await sessionDelete(req("DELETE"), { params: Promise.resolve({ id: user.id, sid }) });
    expect(await code(r)).toBe("self_action");
    const w = await sessionDelete(req("DELETE", undefined, "http://c/x", "wrong"), { params: Promise.resolve({ id: user.id, sid }) });
    expect(w.status).toBe(403);
  });
});

describe("role grants (no privilege escalation)", () => {
  it("Admin cannot grant or remove Superadmin on create, PATCH or bulk; can grant Viewer", async () => {
    await signIn("admin");
    expect((await createPost(req("POST", { ...NEW, roles: ["Superadmin"] }))).status).toBe(403);
    expect(db().users.size).toBe(50);
    const v = idOf("viewer");
    const p = await userPatch(req("PATCH", { roles: ["Viewer", "Superadmin"] }), params(v));
    expect(p.status).toBe(403);
    expect(await code(p)).toBe("forbidden");
    expect(db().users.get(v)!.roles).toEqual(["Viewer"]);
    // removing Superadmin from someone is also refused
    db().users.get(v)!.roles = ["Superadmin", "Viewer"];
    expect((await userPatch(req("PATCH", { roles: ["Viewer"] }), params(v))).status).toBe(403);
    db().users.get(v)!.roles = ["Viewer"];
    const before = acts().length;
    const r = await bulk({ action: "assignRole", ids: [v], role: "Superadmin" });
    expect(await r.json()).toEqual({ done: [], skipped: [{ id: v, code: "forbidden" }] });
    expect(acts().length).toBe(before);
    expect((await userPatch(req("PATCH", { roles: ["Viewer", "Viewer"] }), params(v))).status).toBe(200); // unchanged set, no grant
    const ok = await createPost(req("POST", { ...NEW, roles: ["Viewer"] }));
    expect(ok.status).toBe(201);
    expect((await bulk({ action: "assignRole", ids: [idOf("apple")], role: "Viewer" })).status).toBe(200);
  });

  it("Superadmin can grant Superadmin", async () => {
    await signIn("superadmin");
    const v = idOf("viewer");
    expect((await userPatch(req("PATCH", { roles: ["Viewer", "Superadmin"] }), params(v))).status).toBe(200);
    expect(db().users.get(v)!.roles).toContain("Superadmin");
    expect((await createPost(req("POST", { ...NEW, roles: ["Superadmin"] }))).status).toBe(201);
  });

  it("bulk assignRole with self in ids skips self with self_action", async () => {
    const { user } = await signIn("superadmin");
    const v = idOf("viewer");
    const r = await bulk({ action: "assignRole", ids: [user.id, v], role: "Admin" });
    expect(await r.json()).toEqual({ done: [v], skipped: [{ id: user.id, code: "self_action" }] });
    expect(db().users.get(user.id)!.roles).toEqual(["Superadmin"]);
  });
});

describe("seed as shipped", () => {
  it("Admin can grant Viewer (its permissions are a subset of Admin's)", async () => {
    await signIn("admin");
    expect((await createPost(req("POST", NEW))).status).toBe(201);
  });
});
