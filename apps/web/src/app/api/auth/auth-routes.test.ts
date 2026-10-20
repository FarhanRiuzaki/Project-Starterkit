import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.INTERNAL_API_TOKEN = "i".repeat(40);
  process.env.OAUTH_MOCK = "true";
  process.env.APP_URL = "http://c"; // the site's public origin: what sameOrigin compares Origin with
});
const jar = vi.hoisted(() => new Map<string, string>());
/** The options of the last `set` per cookie name (a clearing set included). */
const cookieOpts = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string, opts: Record<string, unknown> = {}) => {
      cookieOpts.set(name, opts);
      if (value) jar.set(name, value);
      else jar.delete(name);
    },
  }),
}));

import { createHash } from "node:crypto";
import { oauthCookieOptions } from "@/lib/server/oauth";
import { parseConfig } from "@/lib/server/config";
import { cookieOf, fakeApi, pathOf, sealCookie, TEST_CSRF, TEST_TOKEN } from "@/test/session";
import { POST as twoFactor } from "./2fa/route";
import { POST as forgot } from "./forgot/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as oauthCallback, POST as oauthCallbackPost } from "./oauth/[provider]/callback/route";
import { GET as mockAuthorize } from "./oauth/[provider]/mock-authorize/route";
import { GET as oauthStart } from "./oauth/[provider]/route";
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
});

describe("/api/auth/oauth (Google and Apple: browser binding, landing page)", () => {
  const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) });
  const startUrl = (q = "") => new Request(`http://c/api/auth/oauth/google${q}`);
  const landing = async (r: Response) => {
    const html = await r.text();
    return { status: r.status, url: /<meta http-equiv="refresh" content="0;url=([^"]*)">/.exec(html)?.[1], html };
  };
  /** The sk_oauth cookie a start would have set: mode + binding. */
  const bound = (mode = "login", binding = "b".repeat(43)) => jar.set("sk_oauth", `${mode}.${binding}`);

  it("start: a random binding in sk_oauth (httpOnly, /api/auth/oauth, 10 minutes, Lax over HTTP), its hash to the API, 303 to the API's URL", async () => {
    const seen = fakeApi(() => Response.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=s1" }));
    const r = await oauthStart(startUrl("?next=%2Fusers"), ctx("google"));
    expect([r.status, r.headers.get("location")]).toEqual([303, "https://accounts.google.com/o/oauth2/v2/auth?state=s1"]);
    const [mode, binding] = jar.get("sk_oauth")!.split(".");
    expect(mode).toBe("login");
    expect(binding).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookieOpts.get("sk_oauth")).toEqual({ httpOnly: true, path: "/api/auth/oauth", maxAge: 600, secure: false, sameSite: "lax" });
    expect(seen.map((x) => [x.method, pathOf(x), x.headers.get("authorization")])).toEqual([["POST", "/v1/auth/oauth/google/start", null]]);
    expect(await seen[0]!.json()).toEqual({ mode: "login", next: "/users", bindingHash: createHash("sha256").update(binding!).digest("base64url") });
  });

  it("start: a signed-in browser's bearer goes along in login mode too; next is made internal and capped before the API sees it", async () => {
    const seen = fakeApi(() => Response.json({ url: "/api/auth/oauth/google/mock-authorize?state=s1" }));
    await sealCookie(jar);
    await oauthStart(startUrl("?next=%2F%2Fevil.com"), ctx("google"));
    expect(seen[0]!.headers.get("authorization")).toBe(`Bearer ${TEST_TOKEN}`);
    expect((await seen[0]!.json()).next).toBe("/");
    await oauthStart(startUrl(`?next=${encodeURIComponent(`/users?q=${"x".repeat(3000)}`)}`), ctx("google"));
    expect((await seen[1]!.json()).next).toBe("/");
    await oauthStart(startUrl("?next=%2Fusers%3Fpage%3D2"), ctx("google"));
    expect((await seen[2]!.json()).next).toBe("/users?page=2");
  });

  it("logout also clears sk_oauth, so a started round trip can't finish after sign-out", async () => {
    fakeApi(() => Response.json({ ok: true }));
    await sealCookie(jar);
    jar.set("sk_oauth", `link.${"b".repeat(43)}`);
    expect((await post(logout, {}, { "x-csrf-token": TEST_CSRF })).status).toBe(200);
    expect(jar.has("sk_oauth")).toBe(false);
    expect(cookieOpts.get("sk_oauth")).toMatchObject({ path: "/api/auth/oauth", maxAge: 0 });
  });

  it("the binding cookie is Secure and SameSite=None over HTTPS (Apple posts its answer from its own site)", () => {
    const c = parseConfig({ SESSION_SECRET: "s".repeat(40), INTERNAL_API_TOKEN: "i".repeat(40), COOKIE_SECURE: "true" });
    expect(oauthCookieOptions(c)).toEqual({ httpOnly: true, path: "/api/auth/oauth", maxAge: 600, secure: true, sameSite: "none" });
  });

  it("start: link needs a full session (else sign-in, nothing sent) and sends its bearer; unknown provider 404; an API refusal lands on the error", async () => {
    const seen = fakeApi(() => Response.json({ url: "/api/auth/oauth/google/mock-authorize?state=s1" }));
    let r = await oauthStart(startUrl("?mode=link"), ctx("google"));
    expect([r.status, r.headers.get("location")]).toEqual([303, "/login?next=%2Fme%2Fsecurity"]);
    expect(seen).toEqual([]);
    await sealCookie(jar);
    r = await oauthStart(startUrl("?mode=link"), ctx("google"));
    expect(r.headers.get("location")).toBe("/api/auth/oauth/google/mock-authorize?state=s1");
    expect(jar.get("sk_oauth")).toMatch(/^link\./);
    expect(seen[0]!.headers.get("authorization")).toBe(`Bearer ${TEST_TOKEN}`);
    expect((await seen[0]!.json()).mode).toBe("link");
    expect((await oauthStart(startUrl(), ctx("github"))).status).toBe(404);
    expect(seen).toHaveLength(1);
    jar.clear();
    fakeApi(() => fail(404, "not_found"));
    r = await oauthStart(startUrl(), ctx("google"));
    expect([r.status, r.headers.get("location")]).toEqual([303, "/login?error=oauth"]);
    expect(jar.has("sk_oauth")).toBe(false);
  });

  it("start: a link the API refuses for want of a recent proof (403) lands on /me/security?oauth=reauth; other refusals on oauth=failed", async () => {
    await sealCookie(jar);
    fakeApi(() => fail(403, "forbidden"));
    let r = await oauthStart(startUrl("?mode=link"), ctx("google"));
    expect([r.status, r.headers.get("location")]).toEqual([303, "/me/security?oauth=reauth"]);
    expect(jar.has("sk_oauth")).toBe(false);
    fakeApi(() => fail(429, "rate_limited"));
    r = await oauthStart(startUrl("?mode=link"), ctx("google"));
    expect(r.headers.get("location")).toBe("/me/security?oauth=failed");
  });

  it("callback sets the session and answers a meta-refresh page to a safe next", async () => {
    const seen = fakeApi((x) => (pathOf(x) === "/v1/auth/oauth/google/callback" ? Response.json({ next: "/users?a=1&b=2", token: "t5" }) : Response.json({ ok: true })));
    await sealCookie(jar);
    bound();
    const r = await oauthCallback(new Request("http://c/api/auth/oauth/google/callback?code=c1&state=s1"), ctx("google"));
    const page = await landing(r);
    expect([page.status, page.url]).toEqual([200, "/users?a=1&amp;b=2"]);
    expect(page.html).toContain('<a href="/users?a=1&amp;b=2">');
    expect(page.html).not.toMatch(/<script/i);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const s = (await cookieOf(jar))!;
    expect(s.token).toBe("t5");
    expect(s.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(s.csrf).not.toBe(TEST_CSRF);
    expect(jar.has("sk_oauth")).toBe(false); // cleared
    expect(cookieOpts.get("sk_oauth")).toMatchObject({ path: "/api/auth/oauth", maxAge: 0 });
    // The API got the code, state and binding; the previous session ended (one browser, one session).
    expect(seen.map((x) => pathOf(x))).toEqual(["/v1/auth/oauth/google/callback", "/v1/auth/logout"]);
    expect(await seen[0]!.json()).toEqual({ code: "c1", state: "s1", binding: "b".repeat(43) });
  });

  it("next=//evil.com lands on /", async () => {
    for (const next of ["//evil.com", "/\\evil", "https://evil.com", "/login", "/api/me", "\"><script>alert(1)</script>"]) {
      fakeApi(() => Response.json({ next, token: "t6" }));
      bound();
      expect((await landing(await oauthCallback(new Request("http://c/api/auth/oauth/google/callback?code=c&state=s"), ctx("google")))).url, next).toBe("/");
    }
  });

  it("Apple posts the answer as a form; a link lands on the security screen", async () => {
    const seen = fakeApi(() => Response.json({ next: "/me/security?connected=apple" }));
    bound("link");
    const r = await oauthCallbackPost(new Request("http://c/api/auth/oauth/apple/callback", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "code=c2&state=s2&user=%7B%7D",
    }), ctx("apple"));
    expect((await landing(r)).url).toBe("/me/security?connected=apple");
    expect(await seen[0]!.json()).toEqual({ code: "c2", state: "s2", binding: "b".repeat(43) });
    expect(seen[0]!.headers.get("authorization")).toBeNull(); // the link was bound to its user at start
    expect(await cookieOf(jar)).toBeNull(); // no session change
  });

  it("failures land on /login?error=oauth (inactive: error=inactive) or /me/security?oauth=failed; without the binding cookie or a code the API isn't asked", async () => {
    const seen = fakeApi(() => fail(401, "invalid_credentials"));
    const cb = (q: string, p = "google") => oauthCallback(new Request(`http://c/api/auth/oauth/${p}/callback${q}`), ctx(p));
    expect((await landing(await cb("?code=c&state=s"))).url).toBe("/login?error=oauth"); // no sk_oauth
    bound();
    expect((await landing(await cb("?error=access_denied&state=s"))).url).toBe("/login?error=oauth");
    expect(seen).toEqual([]);
    bound();
    expect((await landing(await cb("?code=c&state=s"))).url).toBe("/login?error=oauth");
    bound("link");
    expect((await landing(await cb("?code=c&state=s"))).url).toBe("/me/security?oauth=failed");
    fakeApi(() => fail(403, "account_inactive"));
    bound();
    expect((await landing(await cb("?code=c&state=s"))).url).toBe("/login?error=inactive");
    expect(await cookieOf(jar)).toBeNull();
    expect((await cb("?code=c&state=s", "github")).status).toBe(404);
  });

  it("mock-authorize (OAUTH_MOCK only) sends the browser to the callback with code=mock", async () => {
    const r = await mockAuthorize(new Request("http://c/api/auth/oauth/google/mock-authorize?state=s%2B1"), ctx("google"));
    expect([r.status, r.headers.get("location")]).toEqual([303, "/api/auth/oauth/google/callback?code=mock&state=s%2B1"]);
    expect((await mockAuthorize(new Request("http://c/api/auth/oauth/github/mock-authorize?state=s"), ctx("github"))).status).toBe(404);
  });
});
