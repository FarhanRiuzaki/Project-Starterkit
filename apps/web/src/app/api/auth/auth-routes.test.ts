import { unsealData } from "iron-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
/** The cookie jar behind the mocked `cookies()`: iron-session reads and writes `sk_session` here. */
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import { json, withPermission } from "@/lib/server/api";
import { log } from "@/lib/server/logger";
import { db, resetDb } from "@/lib/server/mock/db";
import { LDAP_PASSWORD, SEED_PASSWORD, TOTP_SECRET } from "@/lib/server/mock/seed";
import { Backoff, loginLimits, RateLimiter, retryText } from "@/lib/server/ratelimit";
import { type AppSession, SESSION_COOKIE } from "@/lib/server/session";
import { totpCode } from "@/lib/server/totp";
import { POST as twoFactor } from "./2fa/route";
import { POST as forgot } from "./forgot/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as oauth } from "./oauth/[provider]/route";
import { POST as reset } from "./reset/route";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
type Handler = (req: Request) => Promise<Response>;

const post = (h: Handler, body: unknown, headers: Record<string, string> = {}) =>
  h(new Request("http://c/api/auth/x", { method: "POST", headers: { "content-type": "application/json", "user-agent": UA, ...headers }, body: JSON.stringify(body) }));
const signInWith = (loginName: string, password = SEED_PASSWORD, extra: Record<string, unknown> = {}) =>
  post(login, { method: "password", login: loginName, password, ...extra });
const viaOauth = (provider: string, next?: string) =>
  oauth(new Request(`http://c/api/auth/oauth/${provider}${next ? `?next=${encodeURIComponent(next)}` : ""}`, { headers: { "user-agent": UA } }),
    { params: Promise.resolve({ provider }) });
const cookie = async (): Promise<AppSession> =>
  jar.has(SESSION_COOKIE) ? unsealData<AppSession>(jar.get(SESSION_COOKIE)!, { password: SECRET }) : {};
const lastAuth = () => [...db().authLog.values()].at(-1)!;
const ok = vi.fn(async () => json({ ok: true }));
const usersGet = () => withPermission(new Request("http://c/api/users"), "user.view", ok);
const freshLimits = () => Object.assign(loginLimits, {
  ip: new RateLimiter(10, 60_000), breaker: new RateLimiter(300, 60_000), userCap: new RateLimiter(5, 60_000), user: new Backoff(),
});

beforeEach(() => {
  resetDb();
  jar.clear();
  freshLimits();
  ok.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/auth/login", () => {
  it("unknown user, wrong password, and LDAP user via password method give identical 401 bodies", async () => {
    const answers = [
      await signInWith("nobody@example.com", "Whatever-123"),
      await signInWith("admin@example.com", "Wrong-password-1"),
      await signInWith("ldap@example.com", LDAP_PASSWORD),
      await post(login, { method: "ldap", login: "admin@example.com", password: SEED_PASSWORD }),
    ];
    const bodies = await Promise.all(answers.map((r) => r.text()));
    expect(answers.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!).error.code).toBe("invalid_credentials");
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("password and LDAP users get a full session with a store record, device and lastLoginAt", async () => {
    const before = db().users.get("u-002")!.lastLoginAt;
    const r = await signInWith("ADMIN@example.com");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ next: "/" });
    const s = await cookie();
    expect(s.pending2fa).toBeUndefined();
    expect(s.csrf).toBeTruthy();
    expect(db().sessions.get(s.sid!)).toMatchObject({ userId: "u-002", device: "Chrome on macOS", ip: "unknown", method: "password" });
    expect(db().users.get("u-002")!.lastLoginAt).not.toBe(before);
    expect((await usersGet()).status).toBe(200);

    const l = await post(login, { method: "ldap", login: "ldap", password: LDAP_PASSWORD });
    expect(l.status).toBe(200);
    expect(db().sessions.get((await cookie()).sid!)).toMatchObject({ userId: "u-006", method: "ldap" });
    expect(db().sessions.has(s.sid!)).toBe(false); // the previous session in this browser ended
  });

  it("inactive user with correct password gets 403 account_inactive", async () => {
    const r = await signInWith("inactive@example.com");
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("account_inactive");
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    const wrong = await signInWith("inactive@example.com", "Wrong-password-1");
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error.code).toBe("invalid_credentials");
  });

  it("malformed body is 400 bad_request", async () => {
    const r = await post(login, { method: "kerberos", login: "admin", password: "x" });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("bad_request");
  });
});

describe("two-factor sign-in", () => {
  it("2FA user gets next=/login/2fa and the pending cookie cannot call GET /api/users (401)", async () => {
    const r = await signInWith("twofa@example.com");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ next: "/login/2fa" });
    const s = await cookie();
    expect(s).toMatchObject({ pending2fa: { userId: "u-004", method: "password" } });
    expect(s.sid).toBeUndefined();
    expect(s.csrf).toBeUndefined();
    expect(db().sessions.size).toBe(0);
    expect((await usersGet()).status).toBe(401);
    expect(ok).not.toHaveBeenCalled();
    expect(jar.has(SESSION_COOKIE)).toBe(true); // the pending sign-in survives for /api/auth/2fa

    const deep = await signInWith("twofa@example.com", SEED_PASSWORD, { next: "/users?page=2" });
    expect(await deep.json()).toEqual({ next: "/login/2fa?next=%2Fusers%3Fpage%3D2" });
  });

  it("valid TOTP completes sign-in; reused recovery code is rejected", async () => {
    await signInWith("twofa@example.com");
    const r = await post(twoFactor, { code: totpCode(TOTP_SECRET), next: "/users" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ next: "/users" });
    const s = await cookie();
    expect(s.pending2fa).toBeUndefined();
    expect(db().sessions.get(s.sid!)?.userId).toBe("u-004");
    expect((await usersGet()).status).toBe(200);

    const codesBefore = db().users.get("u-004")!.recoveryCodes.length;
    await signInWith("twofa@example.com");
    expect((await post(twoFactor, { code: "AAAA-1111" })).status).toBe(200);
    expect(db().users.get("u-004")!.recoveryCodes.length).toBe(codesBefore - 1);
    await signInWith("twofa@example.com");
    const again = await post(twoFactor, { code: "aaaa-1111" });
    expect(again.status).toBe(400);
    expect((await again.json()).error.code).toBe("invalid_code");
    expect((await cookie()).sid).toBeUndefined();
  });

  it("2FA without a pending sign-in is 401", async () => {
    const r = await post(twoFactor, { code: totpCode(TOTP_SECRET) });
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("unauthenticated");
  });
});

describe("logout", () => {
  it("needs the CSRF token, ends the store session and clears the cookie", async () => {
    await signInWith("admin@example.com");
    const { sid, csrf } = await cookie();
    expect((await post(logout, {})).status).toBe(403);
    expect(db().sessions.has(sid!)).toBe(true);
    const r = await post(logout, {}, { "x-csrf-token": csrf! });
    expect(r.status).toBe(200);
    expect(db().sessions.has(sid!)).toBe(false);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("a pending 2FA sign-in can cancel without a token", async () => {
    await signInWith("twofa@example.com");
    expect((await post(logout, {})).status).toBe(200);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("password reset", () => {
  const tokenFrom = (spy: { mock: { calls: unknown[][] } }) => {
    const link = spy.mock.calls.map((c) => (c[0] as { link?: string }).link).find(Boolean);
    return link ? new URL(link, "http://c").searchParams.get("token") : null;
  };

  it("forgot-password answers the same for unknown and known emails", async () => {
    const spy = vi.spyOn(log, "info");
    const known = await post(forgot, { email: "admin@example.com" });
    expect(tokenFrom(spy)).toBeTruthy();
    spy.mockClear();
    const unknown = await post(forgot, { email: "nobody@example.com" });
    const ldap = await post(forgot, { email: "ldap@example.com" });
    expect(tokenFrom(spy)).toBeNull();
    expect([known.status, unknown.status, ldap.status]).toEqual([200, 200, 200]);
    const bodies = await Promise.all([known.text(), unknown.text(), ldap.text()]);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toEqual({ ok: true });
    expect(bodies[0]).not.toContain("token");
  });

  it("reset token works once and expires after 30 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.now();
    const spy = vi.spyOn(log, "info");
    await post(forgot, { email: "admin@example.com" });
    const token = tokenFrom(spy)!;
    expect([...db().resetTokens.keys()]).not.toContain(token); // stored hashed

    expect((await post(reset, { token, password: "short-pass1" })).status).toBe(400); // 11 chars: bad_request, token kept
    const r = await post(reset, { token, password: "New-password-2026" });
    expect(r.status).toBe(200);
    const reuse = await post(reset, { token, password: "New-password-2026" });
    expect(reuse.status).toBe(400);
    expect((await reuse.json()).error.code).toBe("invalid_code");
    expect((await signInWith("admin@example.com", "New-password-2026")).status).toBe(200);

    spy.mockClear();
    await post(forgot, { email: "viewer@example.com" });
    const late = tokenFrom(spy)!;
    vi.setSystemTime(t0 + 30 * 60_000 + 1);
    const expired = await post(reset, { token: late, password: "New-password-2026" });
    expect(expired.status).toBe(400);
    expect((await expired.json()).error.code).toBe("invalid_code");
  });

  it("reset ends the user's sessions", async () => {
    await signInWith("viewer@example.com");
    const { sid } = await cookie();
    const spy = vi.spyOn(log, "info");
    await post(forgot, { email: "viewer@example.com" });
    expect((await post(reset, { token: tokenFrom(spy)!, password: "New-password-2026" })).status).toBe(200);
    expect(db().sessions.has(sid!)).toBe(false);
  });
});

describe("redirects and OAuth", () => {
  it("login and OAuth honour next only for internal paths", async () => {
    const cases: [string, string][] = [
      ["//evil.com", "/"], ["/\\evil", "/"], ["https://x", "/"], ["%2F%2Fevil", "/"], ["/a/..//evil", "/"], ["/login", "/"],
      ["/users?page=2", "/users?page=2"],
    ];
    for (const [next, want] of cases) {
      freshLimits();
      expect(await (await signInWith("admin@example.com", SEED_PASSWORD, { next })).json()).toEqual({ next: want });
      const r = await viaOauth("google", next);
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe(want);
    }
  });

  it("OAuth signs in as the seeded user connected to the provider; other providers are 404", async () => {
    const r = await viaOauth("apple");
    expect(r.status).toBe(303);
    const s = await cookie();
    expect(db().sessions.get(s.sid!)).toMatchObject({ userId: "u-008", method: "apple" });
    expect(s.csrf).toBeTruthy();
    expect((await viaOauth("github")).status).toBe(404);
  });
});

describe("rate limit and sign-in log", () => {
  it("6th failed attempt for one username within a minute is 429", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.now();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(t0 + i * 10_000); // past the soft backoff (1 s, 2 s, 4 s), inside the 1-minute cap
      statuses.push((await signInWith("admin@example.com", `Wrong-password-${i}`)).status);
    }
    vi.setSystemTime(t0 + 50_000);
    const sixth = await signInWith("admin@example.com", SEED_PASSWORD);
    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("retry-after")).toBe("60");
    expect(await sixth.json()).toEqual({ error: { code: "rate_limited", message: retryText(60) } });
  });

  it("every attempt writes one auth log entry with method and event", async () => {
    const steps: [() => Promise<Response>, string, string][] = [
      [() => signInWith("nobody@example.com", "Whatever-123"), "login_failed", "password"],
      [() => signInWith("inactive@example.com"), "login_failed", "password"],
      [() => post(login, { method: "ldap", login: "ldap@example.com", password: LDAP_PASSWORD }), "login_success", "ldap"],
      [() => signInWith("twofa@example.com"), "login_success", "password"],
      [() => post(twoFactor, { code: "zzzz-0000" }), "2fa_failed", "password"],
      [() => post(twoFactor, { code: totpCode(TOTP_SECRET) }), "2fa_success", "password"],
      [() => viaOauth("google"), "login_success", "google"],
    ];
    for (const [run, event, method] of steps) {
      const n = db().authLog.size;
      await run();
      expect(db().authLog.size).toBe(n + 1);
      expect(lastAuth()).toMatchObject({ event, method, device: "Chrome on macOS", ip: "unknown" });
    }
    expect(lastAuth().userId).toBe("u-007");
    const n = db().authLog.size;
    await post(logout, {}, { "x-csrf-token": (await cookie()).csrf! });
    expect(db().authLog.size).toBe(n + 1);
    expect(lastAuth()).toMatchObject({ event: "logout", method: "google", userId: "u-007" });
  });
});
