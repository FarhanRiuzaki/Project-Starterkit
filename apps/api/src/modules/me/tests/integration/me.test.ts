// Port of apps/web/src/app/api/me/me-routes.test.ts against /v1/me*, test for test with the same names.
// Connecting (the OAuth link flow) is tested in modules/oauth/tests/integration/oauth.test.ts.
// Not ported: wrong csrf token (the web checks CSRF, Task 9). Time moves by editing rows, the database clock decides.
// Added: "PATCH /me with the same values writes no activity", "recovery codes are 8 distinct 19-char codes and each works once at /v1/auth/2fa".
import { beforeEach, describe, expect, it } from "bun:test";
import type { Page } from "@starterkit/shared/contracts/common";
import { asc, eq, sql } from "drizzle-orm";
import { call, resetData } from "../../../../../test/helpers/app";
import { rows, sqlColumns } from "../../../../../test/helpers/db";
import { LDAP_PASSWORD, RECOVERY_CODES, SEED_PASSWORD } from "../../../../db/seed/demo";
import { decryptSecret, hashToken } from "../../../../kernel/crypto";
import { db } from "../../../../kernel/db";
import { activity } from "../../../audit";
import { createSession, sessions, totpCode, userTokens } from "../../../auth";
import { userIdentities } from "../../../oauth";
import { recoveryCodes as codesTable, users } from "../../../users"; // tests name their answers `recoveryCodes`

const NEW_PW = "Another-Pass-456!";
const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
const idOf = async (username: string): Promise<string> => (await rows(db.select({ id: users.id }).from(users).where(eq(users.username, username))))[0].id;
const sidOf = async (token: string): Promise<string> => (await rows(db.select({ id: sessions.id }).from(sessions).where(eq(sessions.tokenHash, hashToken(token)))))[0].id;
const addSession = async (userId: string): Promise<string> =>
  (await db.transaction((tx) => createSession(tx, { userId, method: "password", client: { ip: "10.0.0.9", ua: "bun test" } }))).id;
const hasSession = async (id: string) => (await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, id))).length === 1;
const userRow = async (username: string) => (await rows(db.select(sqlColumns(users)).from(users).where(eq(users.username, username))))[0];
const acts = async (): Promise<{ action: string; targetType: string; before: unknown; after: unknown }[]> =>
  db.select({ action: activity.action, targetType: activity.targetType, before: activity.before, after: activity.after }).from(activity).orderBy(asc(activity.at), asc(activity.id));
/** `select 1 from <table> where user_id = …`. */
const rowsOfUser = (t: typeof codesTable | typeof userIdentities | typeof userTokens, userId: string) => db.select({ one: sql`1` }).from(t).where(eq(t.userId, userId));
/** The TOTP secret of twofa@example.com copied to `username` (2FA on, same codes). */
const copyTotp = (username: string) =>
  db.update(users).set({ totpSecret: sql`(${db.select({ s: users.totpSecret }).from(users).where(eq(users.username, "twofa"))})` }).where(eq(users.username, username));
const noPassword = (username: string) => db.update(users).set({ passwordHash: null }).where(eq(users.username, username));
/** A session token for a demo account, straight through createSession (the directory user has no stored password). */
const signIn = async (username: string): Promise<string> =>
  (await db.transaction(async (tx) => createSession(tx, { userId: await idOf(username), method: "password", client: { ip: "127.0.0.1", ua: "bun test" } }))).token;
const me = (method: string, path: string, token: string, body?: unknown) => call(method, `/v1/me${path}`, { token, body });
const login = (pw: string, login = "admin") => call("POST", "/v1/auth/login", { body: { method: "password", login, password: pw } });

/** A signed-in user plus a second session of the same user (another browser). */
async function signedIn(username: string) {
  const token = await signIn(username);
  return { token, sid: await sidOf(token), other: await addSession(await idOf(username)) };
}

beforeEach(resetData);

describe("GET/PATCH /api/me", () => {
  it("needs a session", async () => {
    expect((await call("GET", "/v1/me")).status).toBe(401);
  });

  it("GET returns the user without secrets; PATCH updates name and email with one activity entry", async () => {
    const token = await signIn("twofa");
    const text = await (await me("GET", "", token)).text();
    expect(text).not.toMatch(/passwordHash|totpSecret|recoveryCodes|JBSWY3DPEHPK3PXP/);
    const before = (await acts()).length;
    const r = await me("PATCH", "", token, { name: "New Name", email: "new.name@example.com", currentPassword: SEED_PASSWORD });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ name: "New Name", email: "new.name@example.com", username: "twofa", hasPassword: true });
    const all = await acts();
    expect(all.length).toBe(before + 1);
    expect(all.at(-1)).toMatchObject({ action: "me.update", targetType: "user", before: { name: "Two Factor", email: "twofa@example.com" }, after: { name: "New Name", email: "new.name@example.com" } });
  });

  it("PATCH /me with the same values writes no activity", async () => {
    const token = await signIn("admin");
    const n = (await acts()).length;
    for (const body of [{}, { name: "Admin User" }, { name: "Admin User", email: "admin@example.com" }]) {
      const r = await me("PATCH", "", token, body);
      expect(r.status).toBe(200);
      expect(await r.json()).toMatchObject({ name: "Admin User", email: "admin@example.com" });
    }
    expect((await acts()).length).toBe(n);
  });

  it("ignores username in the body and rejects a taken email with 409 duplicate", async () => {
    const token = await signIn("twofa");
    await me("PATCH", "", token, { username: "hacker" });
    expect((await userRow("twofa")).username).toBe("twofa");
    const r = await me("PATCH", "", token, { email: "ADMIN@example.com", currentPassword: SEED_PASSWORD });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("duplicate");
  });

  it("a bad email is 400", async () => {
    const token = await signIn("twofa");
    expect((await me("PATCH", "", token, { email: "nope" })).status).toBe(400);
  });
});

describe("POST /api/me/password", () => {
  it("a wrong current password is 400 invalid_credentials and changes nothing", async () => {
    const { token, other } = await signedIn("admin");
    const hash = (await userRow("admin")).password_hash;
    const n = (await acts()).length;
    const r = await me("POST", "/password", token, { current: "Wrong-password-1", next: NEW_PW });
    expect(r.status).toBe(400);
    expect(await code(r)).toBe("invalid_credentials");
    expect((await userRow("admin")).password_hash).toBe(hash);
    expect(await hasSession(other)).toBe(true);
    expect((await acts()).length).toBe(n);
  });

  it("an LDAP user gets 409 ldap_password", async () => {
    const token = await signIn("ldap");
    const r = await me("POST", "/password", token, { current: LDAP_PASSWORD, next: NEW_PW });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("ldap_password");
  });

  it("success ends the user's other sessions but not the current one; one activity entry without secrets", async () => {
    const { token, sid, other } = await signedIn("admin");
    const n = (await acts()).length;
    expect((await me("POST", "/password", token, { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(200);
    expect(await hasSession(other)).toBe(false);
    expect(await hasSession(sid)).toBe(true);
    const all = await acts();
    expect(all.length).toBe(n + 1);
    expect(JSON.stringify(all.at(-1))).not.toMatch(/Another-Pass|password_hash|passwordHash|argon2/);
    expect((await login(SEED_PASSWORD)).status).toBe(401);
    expect((await login(NEW_PW)).status).toBe(200);
  });

  it("a too-short new password is 400", async () => {
    const token = await signIn("admin");
    expect((await me("POST", "/password", token, { current: SEED_PASSWORD, next: "short" })).status).toBe(400);
  });
});

describe("/api/me/2fa", () => {
  it("start -> confirm -> next sign-in asks for 2FA; codes come back once, stored hashed, secrets not logged", async () => {
    const token = await signIn("admin");
    expect((await userRow("admin")).totp_secret).toBeNull();
    const s = await me("POST", "/2fa", token);
    expect(s.status).toBe(200);
    const { secret, otpauthUrl } = (await s.json()) as { secret: string; otpauthUrl: string };
    expect(otpauthUrl).toContain(`secret=${secret}`);
    let row = await userRow("admin");
    expect(row.totp_secret).toBeNull();
    expect(row.pending_totp_secret).not.toBe(secret); // encrypted at rest
    expect(decryptSecret(row.pending_totp_secret)).toBe(secret);

    expect((await me("PUT", "/2fa", token, { code: "000000" })).status).toBe(400);
    expect((await userRow("admin")).totp_secret).toBeNull();

    const c = await me("PUT", "/2fa", token, { code: totpCode(secret) });
    expect(c.status).toBe(200);
    const { recoveryCodes } = (await c.json()) as { recoveryCodes: string[] };
    expect(recoveryCodes).toHaveLength(8);
    row = await userRow("admin");
    expect(decryptSecret(row.totp_secret)).toBe(secret);
    expect(row.pending_totp_secret).toBeNull();
    expect(row.totp_last_step).not.toBeNull(); // replay guard
    const stored = await db.select({ code_hash: codesTable.codeHash, used_at: codesTable.usedAt }).from(codesTable).where(eq(codesTable.userId, row.id));
    expect(stored).toHaveLength(8);
    expect(stored.every((r: { code_hash: string; used_at: unknown }) => r.code_hash.startsWith("$argon2id$") && r.used_at === null)).toBe(true);

    for (const p of ["", "/sessions"]) expect(await (await me("GET", p, token)).text()).not.toContain(recoveryCodes[0]!);

    const l = await login(SEED_PASSWORD);
    expect(l.status).toBe(200);
    expect(((await l.json()) as { next: string }).next).toContain("/login/2fa");

    const mine = (await acts()).filter((x) => x.action.startsWith("me.2fa"));
    expect(mine.map((x) => x.action)).toEqual(["me.2fa_setup", "me.2fa_enable"]);
    expect(JSON.stringify(mine)).not.toContain(secret);
    expect(JSON.stringify(mine)).not.toContain(recoveryCodes[0]!);
  });

  it("recovery codes are 8 distinct 19-char codes and each works once at /v1/auth/2fa", async () => {
    const token = await signIn("admin");
    const { secret } = (await (await me("POST", "/2fa", token)).json()) as { secret: string };
    const { recoveryCodes } = (await (await me("PUT", "/2fa", token, { code: totpCode(secret) })).json()) as { recoveryCodes: string[] };
    expect(new Set(recoveryCodes).size).toBe(8);
    for (const c of recoveryCodes) expect(c).toMatch(/^[a-z2-7]{4}(-[a-z2-7]{4}){3}$/);
    expect(recoveryCodes.every((c) => c.length === 19)).toBe(true);
    const challenge = async () => {
      const r = await login(SEED_PASSWORD);
      const j = (await r.json()) as { challenge: string };
      if (!j.challenge) throw new Error(`no challenge: ${r.status} ${JSON.stringify(j)}`);
      return j.challenge;
    };
    const use = async (c: string) => call("POST", "/v1/auth/2fa", { body: { code: c }, headers: { "X-Auth-Challenge": await challenge() } });
    // first and last of the eight: a sign-in is limited to 5 a minute per username
    for (const c of [recoveryCodes[0]!, recoveryCodes[7]!]) {
      expect((await use(c)).status).toBe(200);
      const again = await use(c);
      expect([again.status, await code(again)]).toEqual([400, "invalid_code"]);
    }
  });

  it("confirm without a started setup is 400; start when already on is 409", async () => {
    const token = await signIn("twofa");
    expect((await me("PUT", "/2fa", token, { code: "123456" })).status).toBe(400);
    const on = await me("POST", "/2fa", token);
    expect(on.status).toBe(409);
    expect(await code(on)).toBe("already_enabled");
  });

  it("DELETE needs the current password: wrong is 400, right turns it off and clears secrets", async () => {
    const token = await signIn("twofa");
    const bad = await me("DELETE", "/2fa", token, { password: "nope" });
    expect(bad.status).toBe(400);
    expect(await code(bad)).toBe("invalid_credentials");
    expect((await userRow("twofa")).totp_secret).not.toBeNull();
    expect((await me("DELETE", "/2fa", token, { password: SEED_PASSWORD })).status).toBe(200);
    const row = await userRow("twofa");
    expect(row).toMatchObject({ totp_secret: null, pending_totp_secret: null });
    expect(await rowsOfUser(codesTable, row.id)).toHaveLength(0);
    expect((await acts()).at(-1)).toMatchObject({ action: "me.2fa_disable" });
  });

  it("an LDAP user disables 2FA with the directory password", async () => {
    const token = await signIn("ldap");
    await copyTotp("ldap");
    expect((await me("DELETE", "/2fa", token, { password: SEED_PASSWORD })).status).toBe(400);
    expect((await me("DELETE", "/2fa", token, { password: LDAP_PASSWORD })).status).toBe(200);
    expect((await userRow("ldap")).totp_secret).toBeNull();
  });
});

describe("/api/me/connections/[provider]", () => {
  it("disconnects with one activity entry", async () => {
    const token = await signIn("google");
    const r = await me("DELETE", "/connections/google", token);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { connected: string[] }).connected).toEqual([]);
    expect((await acts()).at(-1)).toMatchObject({ action: "me.disconnect", before: { provider: "google" } });
  });

  it("disconnecting a provider that isn't linked answers 200 and writes no activity", async () => {
    const token = await signIn("google");
    const n = (await acts()).length;
    const r = await me("DELETE", "/connections/apple", token);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { connected: string[] }).connected).toEqual(["google"]);
    expect((await acts()).length).toBe(n);
  });

  it("refuses to disconnect the only way to sign in; an unknown provider is 400", async () => {
    const token = await signIn("google");
    await noPassword("google");
    const r = await me("DELETE", "/connections/google", token);
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("only_sign_in_method");
    expect(await rowsOfUser(userIdentities, await idOf("google"))).toHaveLength(1);
    expect((await me("DELETE", "/connections/github", token)).status).toBe(400);
  });
});

describe("/api/me/sessions", () => {
  it("lists only the caller's sessions and marks the current one", async () => {
    const { token, sid, other } = await signedIn("admin");
    await addSession(await idOf("viewer"));
    const page = (await (await me("GET", "/sessions", token)).json()) as Page<{ id: string; current: boolean }>;
    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 15 });
    expect(page.items.map((s) => s.id).sort()).toEqual([sid, other].sort());
    expect(page.items.find((s) => s.id === sid)!.current).toBe(true);
    expect(page.items.find((s) => s.id === other)!.current).toBe(false);
  });

  it("pages newest activity first by default; sorts by device; rejects bad paging before the guard", async () => {
    const { token } = await signedIn("admin");
    const uid = await idOf("admin");
    for (let i = 0; i < 20; i++) {
      await db.insert(sessions).values({
        id: Bun.randomUUIDv7(), tokenHash: hashToken(`t${i}`), userId: uid, method: "password", device: `Device ${String(i).padStart(2, "0")}`, ip: "10.0.0.1",
        lastSeenAt: sql`now() - make_interval(mins => ${20 - i})`, expiresAt: sql`now() + interval '1 hour'`,
      });
    }
    const get = async (qs: string) => (await (await me("GET", `/sessions?${qs}`, token)).json()) as Page<{ id: string; device: string }>;
    const first = await get("");
    expect(first.total).toBe(22);
    expect(first.items).toHaveLength(15);
    expect(first.items.slice(2, 4).map((s) => s.device)).toEqual(["Device 19", "Device 18"]); // the two "now" sessions, then newest seen
    expect((await get("page=2")).items).toHaveLength(7);
    expect((await get("sort=device&pageSize=25")).items[0]!.device).toBe("Device 00");
    for (const qs of ["pageSize=10", "page=0", "sort=ip", "q=x"]) {
      expect((await call("GET", `/v1/me/sessions?${qs}`)).status, qs).toBe(qs === "q=x" ? 401 : 400);
    }
  });

  it("deletes the caller's own other session (one activity entry); someone else's or unknown is 404", async () => {
    const { token, sid, other } = await signedIn("admin");
    const stranger = await addSession(await idOf("viewer"));
    const r1 = await me("DELETE", `/sessions/${stranger}`, token);
    expect(r1.status).toBe(404);
    expect(await code(r1)).toBe("not_found");
    expect(await hasSession(stranger)).toBe(true);
    expect((await me("DELETE", "/sessions/nope", token)).status).toBe(404);
    expect((await me("DELETE", `/sessions/${Bun.randomUUIDv7()}`, token)).status).toBe(404);
    const cur = await me("DELETE", `/sessions/${sid}`, token);
    expect(cur.status).toBe(409);
    expect(await code(cur)).toBe("self_action");
    const n = (await acts()).length;
    expect((await me("DELETE", `/sessions/${other}`, token)).status).toBe(200);
    expect(await hasSession(other)).toBe(false);
    expect((await acts()).length).toBe(n + 1);
    expect((await acts()).at(-1)).toMatchObject({ action: "me.session_end", targetType: "session" });
  });
});

describe("password guess throttle", () => {
  // The database clock decides; the wait after the 5th failure is 1 s, longer than the requests that follow it.
  const wrong = (token: string) => me("POST", "/password", token, { current: "Wrong-password-1", next: NEW_PW });

  it("after 5 wrong current passwords the next attempt is 429, even with the right one, and 2FA-disable shares the budget", async () => {
    const token = await signIn("twofa");
    for (let i = 0; i < 5; i++) expect((await wrong(token)).status).toBe(400);
    const r = await me("POST", "/password", token, { current: SEED_PASSWORD, next: NEW_PW });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBeTruthy();
    expect(await code(r)).toBe("rate_limited");
    expect((await me("DELETE", "/2fa", token, { password: SEED_PASSWORD })).status).toBe(429);
    expect((await userRow("twofa")).totp_secret).not.toBeNull();
  });

  it("wrong 2FA-disable passwords count toward the same budget", async () => {
    const token = await signIn("twofa");
    for (let i = 0; i < 5; i++) expect((await me("DELETE", "/2fa", token, { password: "nope" })).status).toBe(400);
    expect((await wrong(token)).status).toBe(429);
  });

  it("a successful change clears the failures", async () => {
    const token = await signIn("admin");
    for (let i = 0; i < 4; i++) expect((await wrong(token)).status).toBe(400);
    expect((await me("POST", "/password", token, { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await me("POST", "/password", token, { current: NEW_PW + "x", next: NEW_PW })).status).toBe(400);
    expect((await wrong(token)).status).toBe(429);
  });
});

describe("PATCH /api/me: changing the email needs the current credential", () => {
  it("a password user: missing password is 400, wrong is 400 invalid_credentials, right changes it", async () => {
    const token = await signIn("admin");
    const patch = (body: unknown) => me("PATCH", "", token, body);
    const missing = await patch({ email: "new.admin@example.com" });
    expect(missing.status).toBe(400);
    expect(await code(missing)).toBe("bad_request");
    const wrong = await patch({ email: "new.admin@example.com", currentPassword: "Wrong-password-1" });
    expect(wrong.status).toBe(400);
    expect(await code(wrong)).toBe("invalid_credentials");
    expect((await userRow("admin")).email).toBe("admin@example.com");
    expect((await patch({ email: "new.admin@example.com", currentPassword: SEED_PASSWORD })).status).toBe(200);
    expect((await userRow("admin")).email).toBe("new.admin@example.com");
  });

  it("name only, or the same email in another case, needs no password", async () => {
    const token = await signIn("admin");
    expect((await me("PATCH", "", token, { name: "Admin Renamed" })).status).toBe(200);
    expect((await me("PATCH", "", token, { name: "Admin Again", email: "ADMIN@example.com" })).status).toBe(200);
  });

  it("an LDAP user confirms with the directory password", async () => {
    const token = await signIn("ldap");
    expect(await code(await me("PATCH", "", token, { email: "dir@example.com", currentPassword: SEED_PASSWORD }))).toBe("invalid_credentials");
    expect((await me("PATCH", "", token, { email: "dir@example.com", currentPassword: LDAP_PASSWORD })).status).toBe(200);
  });

  it("an account that signs in only through Google or Apple can't change its email (409 self_action)", async () => {
    const token = await signIn("google");
    await noPassword("google");
    const r = await me("PATCH", "", token, { email: "other@example.com", currentPassword: "anything" });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: { code: string; message: string } }).error).toMatchObject({ code: "self_action", message: expect.stringMatching(/Google or Apple/) });
    expect((await userRow("google")).email).toBe("google@example.com");
  });

  it("wrong passwords share the change-password budget: the 6th attempt is 429", async () => {
    const token = await signIn("admin");
    const patch = (currentPassword: string) => me("PATCH", "", token, { email: "x@example.com", currentPassword });
    for (let i = 0; i < 5; i++) expect((await patch("Wrong-password-1")).status).toBe(400);
    expect((await patch(SEED_PASSWORD)).status).toBe(429);
    expect((await me("POST", "/password", token, { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(429);
  });
});

describe("password guess throttle under concurrency", () => {
  it("parallel wrong guesses reserve the budget: at most 5 are checked, the rest are 429", async () => {
    const token = await signIn("admin");
    const rs = await Promise.all(Array.from({ length: 8 }, () => me("POST", "/password", token, { current: "Wrong-password-1", next: NEW_PW })));
    const codes = rs.map((r) => r.status);
    expect(codes.filter((s) => s === 429).length).toBeGreaterThanOrEqual(3);
    expect(codes.filter((s) => s === 400).length).toBeLessThanOrEqual(5);
    expect(codes.every((s) => s === 400 || s === 429)).toBe(true);
  });
});

describe("product name", () => {
  it("me/routes.ts reads BRAND and has no product-name literal", async () => {
    const src = await Bun.file(new URL("../../service.ts", import.meta.url)).text();
    expect(src).toMatch(/import \{ BRAND \} from "@starterkit\/shared\/brand"/);
    expect(src).not.toMatch(/\bStarterkit\b/);
  });
});

describe("credential changes end other ways in", () => {
  it("changing the password also spends the user's reset and invitation links", async () => {
    const token = await signIn("admin");
    const id = await idOf("admin");
    await db.insert(userTokens).values({ tokenHash: hashToken("open-link"), userId: id, kind: "reset", expiresAt: sql`now() + interval '1 hour'` });
    expect((await me("POST", "/password", token, { current: SEED_PASSWORD, next: NEW_PW })).status).toBe(200);
    expect(await rowsOfUser(userTokens, id)).toHaveLength(0);
  });
});

describe("two-factor for accounts that sign in only through Google or Apple", () => {
  async function oauthOnly(twoFactor: boolean) {
    const token = await signIn("google");
    await noPassword("google");
    if (twoFactor) {
      await copyTotp("google");
      const google = await idOf("google");
      const codes = await db.select({ codeHash: codesTable.codeHash }).from(codesTable).where(eq(codesTable.userId, await idOf("twofa")));
      await db.insert(codesTable).values(codes.map((c) => ({ id: Bun.randomUUIDv7(), userId: google, codeHash: c.codeHash })));
    }
    return token;
  }

  it("can't turn it on: the provider checks them, so a second factor would never be asked (400)", async () => {
    const token = await oauthOnly(false);
    const r = await me("POST", "/2fa", token);
    expect(r.status).toBe(400);
    expect(await code(r)).toBe("bad_request");
    expect((await userRow("google")).pending_totp_secret).toBeNull();
  });

  it("can turn it off with a recovery code (spent), not with a password", async () => {
    const token = await oauthOnly(true);
    expect((await me("DELETE", "/2fa", token, { password: "anything" })).status).toBe(400);
    expect(await code(await me("DELETE", "/2fa", token, { recoveryCode: "zzzz-0000" }))).toBe("invalid_code");
    expect((await userRow("google")).totp_secret).not.toBeNull();
    expect((await me("DELETE", "/2fa", token, { recoveryCode: RECOVERY_CODES[0] })).status).toBe(200);
    const row = await userRow("google");
    expect(row.totp_secret).toBeNull();
    expect(await rowsOfUser(codesTable, row.id)).toHaveLength(0);
  });

  it("a password user can't use a recovery code instead of the password", async () => {
    const token = await signIn("twofa");
    expect((await me("DELETE", "/2fa", token, { recoveryCode: RECOVERY_CODES[0] })).status).toBe(400);
    expect((await me("DELETE", "/2fa", token, { password: SEED_PASSWORD, recoveryCode: RECOVERY_CODES[0] })).status).toBe(400);
  });
});

describe("LDAP 2FA-disable throttle", () => {
  it("5 wrong directory passwords, then 429 even with the right one", async () => {
    const token = await signIn("ldap");
    await copyTotp("ldap");
    for (let i = 0; i < 5; i++) expect((await me("DELETE", "/2fa", token, { password: "Wrong-dir-pass" })).status).toBe(400);
    expect((await me("DELETE", "/2fa", token, { password: LDAP_PASSWORD })).status).toBe(429);
    expect((await userRow("ldap")).totp_secret).not.toBeNull();
  });
});

describe("ended sessions leave the lists", () => {
  it("an expired or idle session of the caller is not listed", async () => {
    const { token, sid } = await signedIn("admin");
    const uid = await idOf("admin");
    const add = async (seen: string, exp: string) => {
      const id = Bun.randomUUIDv7();
      await db.insert(sessions).values({
        id, tokenHash: hashToken(id), userId: uid, method: "password", device: "x", ip: "10.0.0.1", lastSeenAt: sql`now() - ${seen}::interval`, expiresAt: sql`now() + ${exp}::interval`,
      });
      return id;
    };
    const expired = await add("0 minutes", "-1 second");
    const idle = await add("121 minutes", "1 hour");
    const page = (await (await me("GET", "/sessions", token)).json()) as Page<{ id: string }>;
    const ids = page.items.map((s) => s.id);
    expect(ids).toContain(sid);
    expect(ids).not.toContain(expired);
    expect(ids).not.toContain(idle);
    expect((await me("DELETE", `/sessions/${idle}`, token)).status).toBe(404);
  });
});
