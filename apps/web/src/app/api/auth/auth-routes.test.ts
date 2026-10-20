import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.INTERNAL_API_TOKEN = "i".repeat(40);
});
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import { cookieOf, fakeApi, pathOf, sealCookie, TEST_CSRF, TEST_TOKEN } from "@/test/session";
import { POST as twoFactor } from "./2fa/route";
import { POST as forgot } from "./forgot/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as oauth } from "./oauth/[provider]/route";
import { POST as reset } from "./reset/route";

const post = (h: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string> = {}) =>
  h(new Request("http://c/api/auth/x", { method: "POST", headers: { "content-type": "application/json", origin: "http://c", ...headers }, body: JSON.stringify(body) }));
const LOGIN = { method: "password", login: "admin", password: "Password123!" };
const fail = (status: number, code: string, headers: Record<string, string> = {}) => Response.json({ error: { code, message: code } }, { status, headers });

beforeEach(() => jar.clear());
afterEach(() => vi.unstubAllGlobals());

describe("/api/auth (cookie and same origin in Next; credentials checked by the API)", () => {
  it("POSTs from another origin are 403 forbidden and never reach the API", async () => {
    const seen = fakeApi(() => Response.json({ ok: true }));
    for (const h of [login, twoFactor, logout, forgot, reset]) {
      const r = await post(h, LOGIN, { origin: "https://evil.example" });
      expect(r.status).toBe(403);
      expect(((await r.json()) as { error: { code: string } }).error.code).toBe("forbidden");
    }
    expect(seen).toEqual([]);
  });

  it("login stores the session token and a new CSRF token; the browser gets only next", async () => {
    const seen = fakeApi(() => Response.json({ next: "/users", token: "t1" }));
    const r = await post(login, LOGIN);
    expect(await r.json()).toEqual({ next: "/users" });
    const c = await cookieOf(jar);
    expect(c).toMatchObject({ token: "t1" });
    expect(c!.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(seen.map(pathOf)).toEqual(["/v1/auth/login"]);
    expect(await seen[0]!.json()).toEqual(LOGIN);
  });

  it("login ends the browser's previous session at the API, then stores the new one", async () => {
    const seen = fakeApi((r) => (pathOf(r) === "/v1/auth/logout" ? Response.json({ ok: true }) : Response.json({ next: "/", token: "t2" })));
    await sealCookie(jar);
    await post(login, LOGIN);
    expect(seen.map((r) => [pathOf(r), r.headers.get("authorization")])).toEqual([["/v1/auth/login", null], ["/v1/auth/logout", `Bearer ${TEST_TOKEN}`]]);
    const c = await cookieOf(jar);
    expect(c!.token).toBe("t2");
    expect(c!.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(c!.csrf, "a new CSRF token (no session fixation)").not.toBe(TEST_CSRF);
  });

  it("a failed login passes the API's answer through (status, body, Retry-After) and keeps the cookie", async () => {
    fakeApi(() => fail(429, "rate_limited", { "Retry-After": "41" }));
    await sealCookie(jar);
    const r = await post(login, LOGIN);
    expect([r.status, r.headers.get("retry-after")]).toEqual([429, "41"]);
    expect((await cookieOf(jar))!.token).toBe(TEST_TOKEN);
  });

  it("a 2FA account: login stores only the challenge; the code step sends it and stores the session", async () => {
    const seen = fakeApi((r) => (pathOf(r) === "/v1/auth/login"
      ? Response.json({ next: "/login/2fa", challenge: "ch1" })
      : Response.json({ next: "/", token: "t3" })));
    const before = Date.now();
    expect(await (await post(login, LOGIN)).json()).toEqual({ next: "/login/2fa" });
    const pending = await cookieOf(jar);
    expect(pending).toEqual({ challenge: "ch1", challengeAt: expect.any(Number) });
    expect(pending!.challengeAt).toBeGreaterThanOrEqual(before);
    expect(await (await post(twoFactor, { code: "123456" })).json()).toEqual({ next: "/" });
    expect(seen[1]!.headers.get("x-auth-challenge")).toBe("ch1");
    const c = await cookieOf(jar);
    expect([c!.token, c!.challenge, c!.challengeAt]).toEqual(["t3", undefined, undefined]);
    expect(seen.map(pathOf)).toEqual(["/v1/auth/login", "/v1/auth/2fa"]); // the spent challenge needs no logout
  });

  it("2FA: an expired challenge (401) clears the cookie; a wrong code (400) keeps it", async () => {
    fakeApi(() => fail(400, "invalid_code"));
    await sealCookie(jar, { challenge: "ch" });
    expect((await post(twoFactor, { code: "000000" })).status).toBe(400);
    expect(await cookieOf(jar)).toEqual({ challenge: "ch" });
    fakeApi(() => fail(401, "unauthenticated"));
    expect((await post(twoFactor, { code: "000000" })).status).toBe(401);
    expect(await cookieOf(jar)).toBeNull();
  });

  it("a body over 64 KB is 400 and never reaches the API, also when content-length says less", async () => {
    const seen = fakeApi(() => Response.json({ next: "/", token: "t" }));
    const big = JSON.stringify({ ...LOGIN, password: "x".repeat(70 * 1024) });
    for (const headers of [{}, { "content-length": "60" }] as Record<string, string>[]) {
      const r = await login(new Request("http://c/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: "http://c", ...headers }, body: big }));
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: { code: string } }).error.code).toBe("bad_request");
    }
    expect(seen).toEqual([]);
    expect(await cookieOf(jar)).toBeNull();
  });

  it("logout needs the CSRF token with a full session, ends the API session and clears the cookie", async () => {
    const seen = fakeApi(() => Response.json({ ok: true }));
    await sealCookie(jar);
    const bad = await post(logout, {});
    expect(bad.status).toBe(403);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe("csrf");
    expect(seen).toEqual([]);
    expect((await post(logout, {}, { "x-csrf-token": TEST_CSRF })).status).toBe(200);
    expect(seen[0]!.headers.get("authorization")).toBe(`Bearer ${TEST_TOKEN}`);
    expect(await cookieOf(jar)).toBeNull();
  });

  it("a pending 2FA sign-in cancels without a token", async () => {
    const seen = fakeApi(() => Response.json({ ok: true }));
    await sealCookie(jar, { challenge: "ch" });
    expect((await post(logout, {})).status).toBe(200);
    expect(seen[0]!.headers.get("x-auth-challenge")).toBe("ch");
    expect(await cookieOf(jar)).toBeNull();
  });

  it("forgot and reset pass the API's answer through", async () => {
    const seen = fakeApi((r) => (pathOf(r) === "/v1/auth/reset" ? fail(400, "invalid_code") : Response.json({ ok: true })));
    expect(await (await post(forgot, { email: "a@example.com" })).json()).toEqual({ ok: true });
    expect((await post(reset, { token: "x", password: "Another-Pass-456!" })).status).toBe(400);
    expect(seen.map(pathOf)).toEqual(["/v1/auth/forgot", "/v1/auth/reset"]);
  });

  it("OAuth (mock until Task 10): mock-login with next, the session in the cookie, 303 to the API's next", async () => {
    const seen = fakeApi((r) => (pathOf(r).startsWith("/v1/auth/oauth/google/") ? Response.json({ next: "/users", token: "t4" }) : Response.json({ ok: true })));
    await sealCookie(jar);
    const r = await oauth(new Request("http://c/api/auth/oauth/google?next=%2Fusers"), { params: Promise.resolve({ provider: "google" }) });
    expect([r.status, r.headers.get("location")]).toEqual([303, "/users"]);
    expect(seen.map((x) => [x.method, pathOf(x)])).toEqual([["POST", "/v1/auth/oauth/google/mock-login?next=%2Fusers"], ["POST", "/v1/auth/logout"]]);
    expect((await cookieOf(jar))!.token).toBe("t4");
    fakeApi(() => fail(404, "not_found"));
    expect((await oauth(new Request("http://c/api/auth/oauth/github"), { params: Promise.resolve({ provider: "github" }) })).status).toBe(404);
  });
});
