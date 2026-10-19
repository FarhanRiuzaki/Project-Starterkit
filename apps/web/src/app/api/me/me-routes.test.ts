import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import { db, resetDb } from "@/lib/server/mock/db";
import type { Page } from "@/lib/shared/contracts/common";
import { addSession, signInAs, TEST_CSRF } from "@/test/session";
import { hashRecoveryCode, hashToken } from "@/lib/server/mock/password";
import { LDAP_PASSWORD, RECOVERY_CODES, SEED_PASSWORD } from "@/lib/server/mock/seed";
import { passwordFails, passwordKey } from "@/lib/server/ratelimit";
import { totpCode } from "@/lib/server/totp";
import { POST as loginPost } from "../auth/login/route";
import { DELETE as tfaDelete, POST as tfaStart, PUT as tfaConfirm } from "./2fa/route";
import { DELETE as connDelete, POST as connPost } from "./connections/[provider]/route";
import { POST as password } from "./password/route";
import { GET as getMe, PATCH as patchMe } from "./route";
import { DELETE as sessionDelete } from "./sessions/[id]/route";
import { GET as sessionsGet } from "./sessions/route";

const CSRF = TEST_CSRF;
const NEW_PW = "Another-Pass-456!";

/** A signed-in browser for `username`, plus a second store session of the same user (another browser). */
async function signIn(username: string) {
  const s = await signInAs(jar, username);
  return { ...s, other: addSession(s.user.id) };
}

const call = (h: (r: Request) => Promise<Response>, method: string, body?: unknown, csrf = CSRF) =>
  h(new Request("http://c/api/me", { method, headers: { "content-type": "application/json", "x-csrf-token": csrf, origin: "http://c" }, body: body === undefined ? undefined : JSON.stringify(body) }));
const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
const acts = () => [...db().activity.values()];
const login = (pw: string) =>
  loginPost(new Request("http://c/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: "http://c" }, body: JSON.stringify({ method: "password", login: "admin", password: pw }) }));

beforeEach(() => {
  resetDb();
  for (const id of db().users.keys()) passwordFails.succeed(passwordKey(id));
  jar.clear();
});
afterEach(() => vi.useRealTimers());

describe("GET/PATCH /api/me", () => {
  it("needs a session", async () => {
    expect((await call(getMe, "GET")).status).toBe(401);
  });

  it("GET returns the user without secrets; PATCH updates name and email with one activity entry", async () => {
    await signIn("twofa");
    const text = await (await call(getMe, "GET")).text();
    expect(text).not.toMatch(/passwordHash|totpSecret|recoveryCodes|JBSWY3DPEHPK3PXP/);
    const before = acts().length;
    const r = await call(patchMe, "PATCH", { name: "New Name", email: "new.name@example.com", currentPassword: SEED_PASSWORD });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ name: "New Name", email: "new.name@example.com", username: "twofa" });
    expect(acts().length).toBe(before + 1);
    expect(acts().at(-1)).toMatchObject({ action: "me.update", target: { type: "user" } });
  });

  it("ignores username in the body and rejects a taken email with 409 duplicate", async () => {
    const { user } = await signIn("twofa");
    await call(patchMe, "PATCH", { username: "hacker" });
    expect(db().users.get(user.id)!.username).toBe("twofa");
    const r = await call(patchMe, "PATCH", { email: "ADMIN@example.com", currentPassword: SEED_PASSWORD });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("duplicate");
  });

  it("a bad email is 400; a mutation with a wrong csrf token is 403", async () => {
    await signIn("twofa");
    expect((await call(patchMe, "PATCH", { email: "nope" })).status).toBe(400);
    expect((await call(patchMe, "PATCH", { name: "x" }, "wrong")).status).toBe(403);
  });
});

describe("POST /api/me/password", () => {
  it("a wrong current password is 400 invalid_credentials and changes nothing", async () => {
    const { user, other } = await signIn("admin");
    const hash = db().users.get(user.id)!.passwordHash;
    const n = acts().length;
    const r = await call(password, "POST", { current: "Wrong-password-1", next: NEW_PW });
    expect(r.status).toBe(400);
    expect(await code(r)).toBe("invalid_credentials");
    expect(db().users.get(user.id)!.passwordHash).toBe(hash);
    expect(db().sessions.has(other)).toBe(true);
    expect(acts().length).toBe(n);
  });

  it("an LDAP user gets 409 ldap_password", async () => {
    await signIn("ldap");
    const r = await call(password, "POST", { current: LDAP_PASSWORD, next: NEW_PW });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("ldap_password");
  });

  it("success ends the user's other sessions but not the current one; one activity entry without secrets", async () => {
    const { sid, other } = await signIn("admin");
    const n = acts().length;
    expect((await call(password, "POST", { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(200);
    expect(db().sessions.has(other)).toBe(false);
    expect(db().sessions.has(sid)).toBe(true);
    expect(acts().length).toBe(n + 1);
    expect(JSON.stringify(acts().at(-1))).not.toMatch(/Another-Pass|passwordHash|scrypt/);
    jar.clear();
    expect((await login(SEED_PASSWORD)).status).toBe(401);
    expect((await login(NEW_PW)).status).toBe(200);
  });

  it("a too-short new password is 400", async () => {
    await signIn("admin");
    expect((await call(password, "POST", { current: SEED_PASSWORD, next: "short" })).status).toBe(400);
  });
});

describe("/api/me/2fa", () => {
  it("start -> confirm -> next sign-in asks for 2FA; codes come back once, stored hashed, secrets not logged", async () => {
    const { user } = await signIn("admin");
    const rec = db().users.get(user.id)!;
    expect(rec.twoFactorEnabled).toBe(false);
    const s = await call(tfaStart, "POST");
    expect(s.status).toBe(200);
    const { secret, otpauthUrl } = (await s.json()) as { secret: string; otpauthUrl: string };
    expect(otpauthUrl).toContain(`secret=${secret}`);
    expect(rec.twoFactorEnabled).toBe(false);
    expect(rec.totpSecret).toBeNull();

    expect((await call(tfaConfirm, "PUT", { code: "000000" })).status).toBe(400);
    expect(rec.twoFactorEnabled).toBe(false);

    const c = await call(tfaConfirm, "PUT", { code: totpCode(secret) });
    expect(c.status).toBe(200);
    const { recoveryCodes } = (await c.json()) as { recoveryCodes: string[] };
    expect(recoveryCodes).toHaveLength(8);
    expect(rec).toMatchObject({ twoFactorEnabled: true, totpSecret: secret });
    expect(rec.pendingTotpSecret).toBeUndefined();
    expect(rec.recoveryCodes).toEqual(recoveryCodes.map(hashRecoveryCode));
    expect(rec.totpLastStep).toBeDefined(); // replay guard: this step can't sign in again

    for (const h of [getMe, sessionsGet]) expect(await (await call(h, "GET")).text()).not.toContain(recoveryCodes[0]!);

    jar.clear();
    const l = await login(SEED_PASSWORD);
    expect(l.status).toBe(200);
    expect(((await l.json()) as { next: string }).next).toContain("/login/2fa");

    const mine = acts().filter((x) => x.action.startsWith("me.2fa"));
    expect(mine.map((x) => x.action)).toEqual(["me.2fa_setup", "me.2fa_enable"]);
    expect(JSON.stringify(mine)).not.toContain(secret);
    expect(JSON.stringify(mine)).not.toContain(recoveryCodes[0]!);
  });

  it("confirm without a started setup is 400; start when already on is 409", async () => {
    await signIn("twofa");
    expect((await call(tfaConfirm, "PUT", { code: "123456" })).status).toBe(400);
    const on = await call(tfaStart, "POST");
    expect(on.status).toBe(409);
    expect(await code(on)).toBe("already_enabled");
  });

  it("DELETE needs the current password: wrong is 400, right turns it off and clears secrets", async () => {
    const { user } = await signIn("twofa");
    const rec = db().users.get(user.id)!;
    const bad = await call(tfaDelete, "DELETE", { password: "nope" });
    expect(bad.status).toBe(400);
    expect(await code(bad)).toBe("invalid_credentials");
    expect(rec.twoFactorEnabled).toBe(true);
    expect((await call(tfaDelete, "DELETE", { password: SEED_PASSWORD })).status).toBe(200);
    expect(rec).toMatchObject({ twoFactorEnabled: false, totpSecret: null, recoveryCodes: [] });
    expect(acts().at(-1)).toMatchObject({ action: "me.2fa_disable" });
  });

  it("an LDAP user disables 2FA with the directory password", async () => {
    const { user } = await signIn("ldap");
    const rec = db().users.get(user.id)!;
    rec.twoFactorEnabled = true;
    rec.totpSecret = "JBSWY3DPEHPK3PXP";
    expect((await call(tfaDelete, "DELETE", { password: SEED_PASSWORD })).status).toBe(400);
    expect((await call(tfaDelete, "DELETE", { password: LDAP_PASSWORD })).status).toBe(200);
    expect(rec.twoFactorEnabled).toBe(false);
  });
});

describe("/api/me/connections/[provider]", () => {
  const run = (h: typeof connPost, method: string, provider: string) =>
    h(new Request("http://c/api/me/connections/x", { method, headers: { "x-csrf-token": CSRF, origin: "http://c" } }), { params: Promise.resolve({ provider }) });

  it("connects and disconnects, one activity entry each", async () => {
    const { user } = await signIn("twofa");
    const rec = db().users.get(user.id)!;
    rec.connected = [];
    const c = await run(connPost, "POST", "apple");
    expect(c.status).toBe(200);
    expect(((await c.json()) as { connected: string[] }).connected).toEqual(["apple"]);
    expect((await run(connDelete, "DELETE", "apple")).status).toBe(200);
    expect(rec.connected).toEqual([]);
    expect(acts().slice(-2).map((x) => x.action)).toEqual(["me.connect", "me.disconnect"]);
  });

  it("refuses to disconnect the only way to sign in; an unknown provider is 400", async () => {
    const { user } = await signIn("twofa");
    const rec = db().users.get(user.id)!;
    rec.passwordHash = null;
    rec.connected = ["google"];
    const r = await run(connDelete, "DELETE", "google");
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("only_sign_in_method");
    expect(rec.connected).toEqual(["google"]);
    expect((await run(connPost, "POST", "github")).status).toBe(400);
  });
});

describe("/api/me/sessions", () => {
  it("lists only the caller's sessions and marks the current one", async () => {
    const { sid, other } = await signIn("admin");
    addSession("u-003", { id: "theirs" });
    const page = (await (await call(sessionsGet, "GET")).json()) as Page<{ id: string; current: boolean }>;
    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 15 });
    const list = page.items;
    expect(list.map((s) => s.id).sort()).toEqual([sid, other].sort());
    expect(list.find((s) => s.id === sid)!.current).toBe(true);
    expect(list.find((s) => s.id === other)!.current).toBe(false);
  });

  it("pages newest activity first by default; sorts by device; rejects bad paging before the guard", async () => {
    const { sid } = await signIn("admin");
    const me = db().sessions.get(sid)!.userId;
    for (let i = 0; i < 20; i++) addSession(me, { id: `s${i}`, device: `Device ${String(i).padStart(2, "0")}`, lastSeenAt: new Date(Date.now() - (20 - i) * 60_000).toISOString() });
    const get = async (qs: string) => (await (await sessionsGet(new Request(`http://c/api/me/sessions?${qs}`))).json()) as Page<{ id: string; device: string }>;
    const first = await get("");
    expect(first.total).toBe(22);
    expect(first.items).toHaveLength(15);
    expect(first.items.slice(2, 4).map((s) => s.id)).toEqual(["s19", "s18"]); // the two "now" sessions, then newest seen
    expect((await get("page=2")).items).toHaveLength(7);
    expect((await get("sort=device&pageSize=25")).items[0]!.device).toBe("Device 00");
    jar.clear();
    for (const qs of ["pageSize=10", "page=0", "sort=ip", "q=x"]) expect((await sessionsGet(new Request(`http://c/api/me/sessions?${qs}`))).status, qs).toBe(qs === "q=x" ? 401 : 400);
  });

  it("deletes the caller's own other session (one activity entry); someone else's or unknown is 404", async () => {
    const { other } = await signIn("admin");
    const stranger = addSession("u-003");
    const del = (id: string) =>
      sessionDelete(new Request("http://c/api/me/sessions/x", { method: "DELETE", headers: { "x-csrf-token": CSRF } }), { params: Promise.resolve({ id }) });
    const r1 = await del(stranger);
    expect(r1.status).toBe(404);
    expect(await code(r1)).toBe("not_found");
    expect(db().sessions.has(stranger)).toBe(true);
    expect((await del("nope")).status).toBe(404);
    const n = acts().length;
    expect((await del(other)).status).toBe(200);
    expect(db().sessions.has(other)).toBe(false);
    expect(acts().length).toBe(n + 1);
  });
});

describe("password guess throttle", () => {
  const wrong = () => call(password, "POST", { current: "Wrong-password-1", next: NEW_PW });
  // A frozen clock: the backoff after the 5th failure is 1 s, so a slow run must not let it lapse.
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: Date.now() }));

  it("after 5 wrong current passwords the next attempt is 429, even with the right one, and 2FA-disable shares the budget", async () => {
    const { user } = await signIn("twofa");
    const rec = db().users.get(user.id)!;
    for (let i = 0; i < 5; i++) expect((await wrong()).status).toBe(400);
    const r = await call(password, "POST", { current: SEED_PASSWORD, next: NEW_PW });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBeTruthy();
    expect(await code(r)).toBe("rate_limited");
    const d = await call(tfaDelete, "DELETE", { password: SEED_PASSWORD });
    expect(d.status).toBe(429);
    expect(rec.twoFactorEnabled).toBe(true);
  });

  it("wrong 2FA-disable passwords count toward the same budget", async () => {
    await signIn("twofa");
    for (let i = 0; i < 5; i++) expect((await call(tfaDelete, "DELETE", { password: "nope" })).status).toBe(400);
    expect((await wrong()).status).toBe(429);
  });

  it("a successful change clears the failures", async () => {
    await signIn("admin");
    for (let i = 0; i < 4; i++) expect((await wrong()).status).toBe(400);
    expect((await call(password, "POST", { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await call(password, "POST", { current: NEW_PW + "x", next: NEW_PW })).status).toBe(400);
    expect((await wrong()).status).toBe(429);
  });
});

describe("PATCH /api/me: changing the email needs the current credential", () => {
  const patch = (body: unknown) => call(patchMe, "PATCH", body);

  it("a password user: missing password is 400, wrong is 400 invalid_credentials, right changes it", async () => {
    const { user } = await signIn("admin");
    const missing = await patch({ email: "new.admin@example.com" });
    expect(missing.status).toBe(400);
    expect(await code(missing)).toBe("bad_request");
    const wrong = await patch({ email: "new.admin@example.com", currentPassword: "Wrong-password-1" });
    expect(wrong.status).toBe(400);
    expect(await code(wrong)).toBe("invalid_credentials");
    expect(db().users.get(user.id)!.email).toBe("admin@example.com");
    expect((await patch({ email: "new.admin@example.com", currentPassword: SEED_PASSWORD })).status).toBe(200);
    expect(db().users.get(user.id)!.email).toBe("new.admin@example.com");
  });

  it("name only, or the same email in another case, needs no password", async () => {
    await signIn("admin");
    expect((await patch({ name: "Admin Renamed" })).status).toBe(200);
    expect((await patch({ name: "Admin Again", email: "ADMIN@example.com" })).status).toBe(200);
  });

  it("an LDAP user confirms with the directory password", async () => {
    await signIn("ldap");
    expect(await code(await patch({ email: "dir@example.com", currentPassword: SEED_PASSWORD }))).toBe("invalid_credentials");
    expect((await patch({ email: "dir@example.com", currentPassword: LDAP_PASSWORD })).status).toBe(200);
  });

  it("an account that signs in only through Google or Apple can't change its email (409 self_action)", async () => {
    const { user } = await signIn("google");
    db().users.get(user.id)!.passwordHash = null;
    const r = await patch({ email: "other@example.com", currentPassword: "anything" });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: { code: string; message: string } }).error).toMatchObject({ code: "self_action", message: expect.stringMatching(/Google or Apple/) });
    expect(db().users.get(user.id)!.email).toBe("google@example.com");
  });

  it("wrong passwords share the change-password budget: the 6th attempt is 429", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() });
    await signIn("admin");
    for (let i = 0; i < 5; i++) expect((await patch({ email: "x@example.com", currentPassword: "Wrong-password-1" })).status).toBe(400);
    expect((await patch({ email: "x@example.com", currentPassword: SEED_PASSWORD })).status).toBe(429);
    expect((await call(password, "POST", { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(429);
  });
});

describe("credential changes end other ways in", () => {
  it("changing the password also spends the user's reset and invitation links", async () => {
    const { user } = await signIn("admin");
    db().resetTokens.set(hashToken("open-link"), { userId: user.id, expiresAt: Date.now() + 3600_000 });
    expect((await call(password, "POST", { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(200);
    expect([...db().resetTokens.values()].some((t) => t.userId === user.id)).toBe(false);
  });
});

describe("two-factor for accounts that sign in only through Google or Apple", () => {
  async function oauthOnly(twoFactor: boolean) {
    const s = await signIn("google");
    const rec = db().users.get(s.user.id)!;
    rec.passwordHash = null;
    if (twoFactor) Object.assign(rec, { twoFactorEnabled: true, totpSecret: "JBSWY3DPEHPK3PXP", recoveryCodes: RECOVERY_CODES.map(hashRecoveryCode) });
    return rec;
  }

  it("can't turn it on: the provider checks them, so a second factor would never be asked (400)", async () => {
    const rec = await oauthOnly(false);
    const r = await call(tfaStart, "POST");
    expect(r.status).toBe(400);
    expect(await code(r)).toBe("bad_request");
    expect(rec.pendingTotpSecret).toBeUndefined();
  });

  it("can turn it off with a recovery code (spent), not with a password", async () => {
    const rec = await oauthOnly(true);
    expect((await call(tfaDelete, "DELETE", { password: "anything" })).status).toBe(400);
    expect(await code(await call(tfaDelete, "DELETE", { recoveryCode: "zzzz-0000" }))).toBe("invalid_code");
    expect(rec.twoFactorEnabled).toBe(true);
    expect((await call(tfaDelete, "DELETE", { recoveryCode: RECOVERY_CODES[0] })).status).toBe(200);
    expect(rec).toMatchObject({ twoFactorEnabled: false, totpSecret: null, recoveryCodes: [] });
  });

  it("a password user can't use a recovery code instead of the password", async () => {
    await signIn("twofa");
    expect((await call(tfaDelete, "DELETE", { recoveryCode: RECOVERY_CODES[0] })).status).toBe(400);
    expect((await call(tfaDelete, "DELETE", { password: SEED_PASSWORD, recoveryCode: RECOVERY_CODES[0] })).status).toBe(400);
  });
});

describe("LDAP 2FA-disable throttle", () => {
  it("5 wrong directory passwords, then 429 even with the right one", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() });
    const { user } = await signIn("ldap");
    Object.assign(db().users.get(user.id)!, { twoFactorEnabled: true, totpSecret: "JBSWY3DPEHPK3PXP" });
    for (let i = 0; i < 5; i++) expect((await call(tfaDelete, "DELETE", { password: "Wrong-dir-pass" })).status).toBe(400);
    const r = await call(tfaDelete, "DELETE", { password: LDAP_PASSWORD });
    expect(r.status).toBe(429);
    expect(db().users.get(user.id)!.twoFactorEnabled).toBe(true);
  });
});

describe("ended sessions leave the lists", () => {
  it("an expired or idle session of the caller is not listed and is removed from the store", async () => {
    const { user, sid } = await signIn("admin");
    const expired = addSession(user.id, { expiresAt: new Date(Date.now() - 1).toISOString() });
    const idle = addSession(user.id, { lastSeenAt: new Date(Date.now() - 121 * 60_000).toISOString() });
    const page = (await (await call(sessionsGet, "GET")).json()) as Page<{ id: string }>;
    expect(page.items.map((s) => s.id)).not.toContain(expired);
    expect(page.items.map((s) => s.id)).not.toContain(idle);
    expect(page.items.map((s) => s.id)).toContain(sid);
    expect(db().sessions.has(expired)).toBe(false);
    expect(db().sessions.has(idle)).toBe(false);
  });
});
