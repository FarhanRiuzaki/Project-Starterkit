// OAuth sign-in and account linking (/v1/auth/oauth/{provider}/start|callback, /v1/auth/providers). The mock provider
// (OAUTH_MOCK, on in tests) goes through the same state rows; the real flow runs against a stubbed token endpoint and
// id_tokens signed with a local key pair (no network). Ports the mock OAuth tests of Tasks 7/9 (connect, next, inactive).
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { SelectedFields } from "drizzle-orm/pg-core";
import { exportPKCS8, generateKeyPair } from "jose";
import { call, resetData, signIn } from "../../../../../test/helpers/app";
import { rows, sqlColumns } from "../../../../../test/helpers/db";
import { AUD, idToken, trustedKeys } from "../../../../../test/helpers/id-token";
import * as conf from "../../../../kernel/config";
import { hashToken } from "../../../../kernel/crypto";
import { db } from "../../../../kernel/db";
import { activity, authLog } from "../../../audit";
import { sessions } from "../../../auth";
import { users } from "../../../users";
import { providerKeys } from "../../providers";
import { oauthStates, userIdentities } from "../../schema";

type Answer = { url: string; next: string; token: string; google: boolean; apple: boolean; error: { code: string; message: string } };
type Res = Omit<Response, "json"> & { json(): Promise<Answer> };

const BINDING = "browser-binding-of-the-test";
const bindingHash = (b = BINDING) => hashToken(b).toString("base64url");
const start = (provider: string, body: Record<string, unknown> = {}, token?: string) =>
  call("POST", `/v1/auth/oauth/${provider}/start`, { token, body: { mode: "login", bindingHash: bindingHash(), ...body } }) as Promise<Res>;
const callback = (provider: string, body: Record<string, unknown>) =>
  call("POST", `/v1/auth/oauth/${provider}/callback`, { body: { binding: BINDING, ...body } }) as Promise<Res>;
/** The state of an authorize URL (the mock's or a provider's). */
const stateOf = (url: string) => new URL(url, "http://x").searchParams.get("state")!;
/** Start + callback through the mock provider. */
async function mockFlow(provider: string, body: Record<string, unknown> = {}, token?: string): Promise<Res> {
  const s = await start(provider, body, token);
  expect(s.status).toBe(200);
  return callback(provider, { code: "mock", state: stateOf((await s.json()).url) });
}
const idOf = async (username: string): Promise<string> => (await rows(db.select({ id: users.id }).from(users).where(eq(users.username, username))))[0].id;
const sessionOf = async (token: string) => (await rows(db.select(sqlColumns(sessions)).from(sessions).where(eq(sessions.tokenHash, hashToken(token)))))[0];
const TABLES = { sessions, users, oauth_states: oauthStates, user_identities: userIdentities, activity };
const count = async (table: "sessions" | "users" | "oauth_states" | "user_identities" | "activity") => db.$count(TABLES[table]);
const lastAuth = async () =>
  (await rows(db.select({ event: authLog.event, method: authLog.method, login: authLog.login, userId: authLog.userId }).from(authLog).orderBy(desc(authLog.at), desc(authLog.id)).limit(1)))[0];
const acts = async (): Promise<{ action: string; after: unknown }[]> => db.select({ action: activity.action, after: activity.after }).from(activity).orderBy(asc(activity.at), asc(activity.id));
/** `select <cols> from user_identities where user_id = …` (one constant column by default). */
const identitiesOf = (userId: string, cols: SelectedFields = { one: sql`1` }) => rows(db.select(cols).from(userIdentities).where(eq(userIdentities.userId, userId)));

beforeEach(resetData);

describe("mock provider (OAUTH_MOCK)", () => {
  it("mock login signs in google@example.com: session, login_success with the provider, lastLoginAt", async () => {
    const r = await mockFlow("google");
    expect(r.status).toBe(200);
    const { next, token } = await r.json();
    expect(next).toBe("/");
    expect(await sessionOf(token)).toMatchObject({ user_id: await idOf("google"), method: "google" });
    expect(await lastAuth()).toMatchObject({ event: "login_success", method: "google", login: "google@example.com", userId: await idOf("google") });
    expect((await rows(db.select({ last_login_at: users.lastLoginAt }).from(users).where(eq(users.username, "google"))))[0].last_login_at).not.toBeNull();
  });

  it("a sign-in from a browser that was signed in ends that browser's earlier session", async () => {
    const old = await signIn("admin");
    const r = await mockFlow("google", {}, old);
    expect(r.status).toBe(200);
    expect(await sessionOf(old)).toBeUndefined();
    expect(await sessionOf((await r.json()).token)).toMatchObject({ user_id: await idOf("google") });
    expect(await count("sessions")).toBe(1);
  });

  it("the 21st start from one client within a minute is 429 with Retry-After, and stores no state", async () => {
    const fromIp = () => call("POST", "/v1/auth/oauth/google/start", { body: { mode: "login", bindingHash: bindingHash() }, headers: { "X-Client-Ip": "10.0.0.7" } }) as Promise<Res>;
    for (let i = 0; i < 20; i++) expect((await fromIp()).status).toBe(200);
    const r = await fromIp();
    expect(r.status).toBe(429);
    expect((await r.json()).error.code).toBe("rate_limited");
    expect(Number(r.headers.get("retry-after"))).toBeWithin(1, 61);
    expect(await count("oauth_states")).toBe(20);
  });

  it("an unknown client IP (no TRUSTED_PROXY) has no per-IP limit: the 21st start passes (the fleet-wide one still counts)", async () => {
    for (let i = 0; i < 21; i++) expect((await start("google")).status).toBe(200);
  });

  it("start answers the mock authorize URL and stores the state hashed, bound to the browser, for 10 minutes", async () => {
    const { url } = await (await start("apple", { next: "/users" })).json();
    expect(url).toMatch(/^\/api\/auth\/oauth\/apple\/mock-authorize\?state=[A-Za-z0-9_-]{43}$/);
    const [row] = await rows(db.select({
      provider: oauthStates.provider, mode: oauthStates.mode, user_id: oauthStates.userId, binding_hash: oauthStates.bindingHash, next: oauthStates.next,
      ttl: sql`extract(epoch from ${oauthStates.expiresAt} - now())::int`,
    }).from(oauthStates).where(eq(oauthStates.stateHash, hashToken(stateOf(url)))));
    expect(row).toMatchObject({ provider: "apple", mode: "login", user_id: null, next: "/users" });
    expect(Buffer.from(row.binding_hash).equals(hashToken(BINDING))).toBe(true);
    expect(row.ttl).toBeWithin(595, 601);
  });

  it("OAuth honours next only for internal paths", async () => {
    const cases: [string, string][] = [
      ["//evil.com", "/"], ["/\\evil", "/"], ["https://x", "/"], ["%2F%2Fevil", "/"], ["/a/..//evil", "/"], ["/login", "/"],
      ["/users?page=2", "/users?page=2"],
    ];
    for (const [next, want] of cases) expect((await (await mockFlow("google", { next })).json()).next, next).toBe(want);
  });

  it("an inactive linked account is 403 account_inactive and gets no session", async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.username, "google"));
    const r = await mockFlow("google");
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("account_inactive");
    expect(await count("sessions")).toBe(0);
    expect(await lastAuth()).toMatchObject({ event: "login_failed", method: "google", userId: await idOf("google") });
  });

  it("an unknown or unavailable provider is 404 at start and callback", async () => {
    for (const p of ["github", "Google"]) {
      expect((await start(p)).status, p).toBe(404);
      expect((await callback(p, { code: "mock", state: "x" })).status, p).toBe(404);
    }
    const off = spyOn(conf, "config").mockReturnValue({ ...conf.config(), OAUTH_MOCK: false });
    try {
      expect((await start("google")).status).toBe(404); // no mock and no client keys
    } finally {
      off.mockRestore();
    }
    expect(await count("oauth_states")).toBe(0);
  });

  it("a malformed body is 400 bad_request", async () => {
    expect((await start("google", { bindingHash: "short" })).status).toBe(400);
    expect((await start("google", { mode: "other" })).status).toBe(400);
    expect((await callback("google", { code: "mock" })).status).toBe(400);
  });
});

describe("state", () => {
  it("state works once", async () => {
    const { url } = await (await start("google")).json();
    expect((await callback("google", { code: "mock", state: stateOf(url) })).status).toBe(200);
    const again = await callback("google", { code: "mock", state: stateOf(url) });
    expect(again.status).toBe(401);
    expect((await again.json()).error.code).toBe("unauthenticated");
    expect(await count("sessions")).toBe(1);
  });

  it("wrong binding is 401, and the state is spent even so", async () => {
    const { url } = await (await start("google")).json();
    expect((await callback("google", { code: "mock", state: stateOf(url), binding: "another-browser" })).status).toBe(401);
    expect((await callback("google", { code: "mock", state: stateOf(url) })).status).toBe(401);
    expect(await count("sessions")).toBe(0);
  });

  it("expired state is 401 and spent", async () => {
    const { url } = await (await start("google")).json();
    await db.update(oauthStates).set({ expiresAt: sql`now() - interval '1 millisecond'` });
    expect((await callback("google", { code: "mock", state: stateOf(url) })).status).toBe(401);
    expect(await count("oauth_states")).toBe(0);
    expect(await count("sessions")).toBe(0);
  });

  it("a state started for one provider doesn't finish another", async () => {
    const { url } = await (await start("google")).json();
    expect((await callback("apple", { code: "mock", state: stateOf(url) })).status).toBe(401);
    expect(await count("oauth_states")).toBe(0);
  });

  it("the mock accepts only its own code", async () => {
    const { url } = await (await start("google")).json();
    expect((await callback("google", { code: "real-looking-code", state: stateOf(url) })).status).toBe(401);
    expect(await count("sessions")).toBe(0);
  });
});

describe("linking (mode link)", () => {
  it("connects and disconnects, one activity entry each", async () => {
    const token = await signIn("twofa");
    const r = await mockFlow("apple", { mode: "link" }, token);
    expect(r.status).toBe(200);
    expect<unknown>(await r.json()).toEqual({ next: "/me/security?connected=apple" });
    expect(await identitiesOf(await idOf("twofa"), { subject: userIdentities.subject })).toEqual([{ subject: `mock-apple-${await idOf("twofa")}` }]);
    expect((await call("DELETE", "/v1/me/connections/apple", { token })).status).toBe(200);
    expect(await identitiesOf(await idOf("twofa"))).toHaveLength(0);
    expect((await acts()).slice(-2)).toEqual([{ action: "me.connect", after: { provider: "apple" } }, { action: "me.disconnect", after: null }]);
  });

  it("connecting a provider already linked succeeds and writes no activity", async () => {
    const token = await signIn("google");
    const n = await count("activity");
    const r = await mockFlow("google", { mode: "link" }, token);
    expect(r.status).toBe(200);
    expect(await identitiesOf(await idOf("google"), { subject: userIdentities.subject })).toEqual([{ subject: "mock-google-demo" }]);
    expect(await count("activity")).toBe(n);
  });

  it("link needs a signed-in user at start (401) and stores who started it", async () => {
    expect((await start("google", { mode: "link" })).status).toBe(401);
    expect(await count("oauth_states")).toBe(0);
    const token = await signIn("admin");
    await start("google", { mode: "link", next: "/users" }, token);
    expect((await rows(db.select({ mode: oauthStates.mode, user_id: oauthStates.userId, session_id: oauthStates.sessionId, next: oauthStates.next }).from(oauthStates)))[0])
      .toEqual({ mode: "link", user_id: await idOf("admin"), session_id: (await sessionOf(token)).id, next: null });
  });

  it("a link state whose session ended fails and links nothing (sign-out cascades; an idle session is checked)", async () => {
    const token = await signIn("twofa");
    const first = await (await start("apple", { mode: "link" }, token)).json();
    await call("POST", "/v1/auth/logout", { token }); // sign-out deletes the session, and with it the pending state
    expect(await count("oauth_states")).toBe(0);
    expect((await callback("apple", { code: "mock", state: stateOf(first.url) })).status).toBe(401);
    const again = await signIn("twofa");
    const second = await (await start("apple", { mode: "link" }, again)).json();
    await db.update(sessions).set({ lastSeenAt: sql`now() - interval '1 day'` }); // idle: ended, row not yet removed
    expect((await callback("apple", { code: "mock", state: stateOf(second.url) })).status).toBe(401);
    expect(await count("oauth_states")).toBe(0);
    expect(await identitiesOf(await idOf("twofa"))).toHaveLength(0);
  });

  it("link needs the session to have proved the user within 10 minutes (403 forbidden, no state); POST /v1/me/reauth renews it", async () => {
    const token = await signIn("admin");
    await db.update(sessions).set({ reauthAt: sql`now() - interval '11 minutes'` }).where(eq(sessions.tokenHash, hashToken(token)));
    const r = await start("google", { mode: "link" }, token);
    expect(r.status).toBe(403);
    expect((await r.json()).error).toEqual({ code: "forbidden", message: "Confirm your password to connect another account." });
    expect(await count("oauth_states")).toBe(0);
    expect((await start("google", { mode: "login" }, token)).status).toBe(200); // a sign-in needs no proof
    expect((await call("POST", "/v1/me/reauth", { token, body: { password: "Password123!" } })).status).toBe(200);
    expect((await mockFlow("google", { mode: "link" }, token)).status).toBe(200);
    expect(await identitiesOf(await idOf("admin"))).toHaveLength(1);
  });

  it("a user deactivated before the callback links nothing", async () => {
    const token = await signIn("twofa");
    const { url } = await (await start("apple", { mode: "link" }, token)).json();
    await db.update(users).set({ isActive: false }).where(eq(users.username, "twofa"));
    expect((await callback("apple", { code: "mock", state: stateOf(url) })).status).toBe(401);
    expect(await identitiesOf(await idOf("twofa"))).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ real providers (stubbed token endpoint, local keys)

const appleKey = await generateKeyPair("ES256", { extractable: true });
const REAL = {
  OAUTH_MOCK: false,
  GOOGLE_CLIENT_ID: AUD.google, GOOGLE_CLIENT_SECRET: "google-client-secret",
  APPLE_CLIENT_ID: AUD.apple, APPLE_TEAM_ID: "TEAM123456", APPLE_KEY_ID: "KEY1234567", APPLE_PRIVATE_KEY: await exportPKCS8(appleKey.privateKey),
};

let restore: (() => void)[] = [];
afterEach(() => {
  for (const r of restore) r();
  restore = [];
});
/** Real providers configured (no mock), the local JWKS trusted, and the token endpoint answering `answer`; returns the token requests seen. */
async function realProviders(answer: (body: URLSearchParams, url: string) => Promise<Response> | Response): Promise<{ url: string; body: URLSearchParams }[]> {
  const jwks = await trustedKeys();
  const saved = { ...providerKeys };
  providerKeys.google = jwks;
  providerKeys.apple = jwks;
  const cfg = spyOn(conf, "config").mockReturnValue({ ...conf.config(), ...REAL });
  const seen: { url: string; body: URLSearchParams }[] = [];
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input: Request) => {
    const body = new URLSearchParams(await input.text());
    seen.push({ url: input.url, body });
    return answer(body, input.url);
  }) as unknown as typeof fetch);
  restore.push(() => Object.assign(providerKeys, saved), () => cfg.mockRestore(), () => fetchSpy.mockRestore());
  return seen;
}
/** Start with a real provider; returns the authorize URL's state and nonce. */
async function realStart(p: "google" | "apple", body: Record<string, unknown> = {}, token?: string) {
  const r = await start(p, body, token);
  expect(r.status).toBe(200);
  const u = new URL((await r.json()).url);
  return { u, state: u.searchParams.get("state")!, nonce: u.searchParams.get("nonce")! };
}

describe("real providers", () => {
  it("start: Google's authorize URL with PKCE (S256), state, nonce and the callback; the verifier is stored for the exchange", async () => {
    await realProviders(() => new Response(null, { status: 500 }));
    const { u, state, nonce } = await realStart("google");
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      response_type: "code", client_id: REAL.GOOGLE_CLIENT_ID, scope: "openid email", code_challenge_method: "S256",
      redirect_uri: "http://localhost:3000/api/auth/oauth/google/callback",
    });
    const [row] = await rows(db.select({ code_verifier: oauthStates.codeVerifier, nonce: oauthStates.nonce }).from(oauthStates).where(eq(oauthStates.stateHash, hashToken(state))));
    expect(row.nonce).toBe(nonce);
    expect(u.searchParams.get("code_challenge")).toBe(Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(row.code_verifier))).toString("base64url"));
  });

  it("start: Apple's authorize URL posts the answer back (form_post) and asks for name and email", async () => {
    await realProviders(() => new Response(null, { status: 500 }));
    const { u } = await realStart("apple");
    expect(u.origin + u.pathname).toBe("https://appleid.apple.com/auth/authorize");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      response_type: "code", client_id: REAL.APPLE_CLIENT_ID, scope: "name email", response_mode: "form_post",
      redirect_uri: "http://localhost:3000/api/auth/oauth/apple/callback",
    });
    expect(u.searchParams.get("nonce")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("callback exchanges the code with the stored verifier and signs in the linked user", async () => {
    const ctx = { nonce: "" };
    const seen = await realProviders(async () => Response.json({ access_token: "a", token_type: "Bearer", id_token: await idToken("google", { sub: "mock-google-demo", nonce: ctx.nonce }) }));
    const { state, nonce } = await realStart("google", { next: "/users" });
    ctx.nonce = nonce;
    const [{ code_verifier: verifier }] = await rows(db.select({ code_verifier: oauthStates.codeVerifier }).from(oauthStates).where(eq(oauthStates.stateHash, hashToken(state))));
    const r = await callback("google", { code: "code-from-google", state });
    expect(r.status).toBe(200);
    const { next, token } = await r.json();
    expect(next).toBe("/users");
    expect(await sessionOf(token)).toMatchObject({ user_id: await idOf("google"), method: "google" });
    expect(seen.map((s) => [s.url, s.body.get("grant_type"), s.body.get("code"), s.body.get("code_verifier")]))
      .toEqual([["https://oauth2.googleapis.com/token", "authorization_code", "code-from-google", verifier]]);
  });

  it("Apple: the exchange sends a client secret signed with the Apple key, and the linked user signs in", async () => {
    const ctx = { nonce: "" };
    const seen = await realProviders(async () => Response.json({ access_token: "a", token_type: "Bearer", id_token: await idToken("apple", { sub: "mock-apple-demo", nonce: ctx.nonce }) }));
    const { state, nonce } = await realStart("apple");
    ctx.nonce = nonce;
    const r = await callback("apple", { code: "code-from-apple", state });
    expect(r.status).toBe(200);
    expect(await sessionOf((await r.json()).token)).toMatchObject({ user_id: await idOf("apple"), method: "apple" });
    expect(seen[0]!.url).toBe("https://appleid.apple.com/auth/token");
    expect(seen[0]!.body.get("client_secret")!.split(".")).toHaveLength(3);
  });

  it("login with an unlinked identity is invalid_credentials and creates no user", async () => {
    const ctx = { nonce: "" };
    await realProviders(async () => Response.json({ access_token: "a", token_type: "Bearer", id_token: await idToken("google", { sub: "someone-new", nonce: ctx.nonce, email: "admin@example.com" }) }));
    const users = await count("users");
    const { state, nonce } = await realStart("google");
    ctx.nonce = nonce;
    const r = await callback("google", { code: "c", state });
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("invalid_credentials");
    expect(await count("users")).toBe(users);
    expect(await count("sessions")).toBe(0);
    expect(await count("user_identities")).toBe(2); // the seed's two; no link by email either
    expect(await lastAuth()).toMatchObject({ event: "login_failed", method: "google", login: "admin@example.com", userId: null });
  });

  it("link of an identity owned by another user is 409 duplicate", async () => {
    const ctx = { nonce: "" };
    await realProviders(async () => Response.json({ access_token: "a", token_type: "Bearer", id_token: await idToken("google", { sub: "mock-google-demo", nonce: ctx.nonce }) }));
    const token = await signIn("admin");
    const { state, nonce } = await realStart("google", { mode: "link" }, token);
    ctx.nonce = nonce;
    const r = await callback("google", { code: "c", state });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("duplicate");
    expect(await identitiesOf(await idOf("admin"))).toHaveLength(0);
  });

  it("link stores the provider's subject and email, with one me.connect entry", async () => {
    const ctx = { nonce: "" };
    await realProviders(async () => Response.json({ access_token: "a", token_type: "Bearer", id_token: await idToken("google", { sub: "g-123", nonce: ctx.nonce }) }));
    const token = await signIn("admin");
    const { state, nonce } = await realStart("google", { mode: "link" }, token);
    ctx.nonce = nonce;
    expect((await callback("google", { code: "c", state })).status).toBe(200);
    expect(await identitiesOf(await idOf("admin"), { provider: userIdentities.provider, subject: userIdentities.subject, email: userIdentities.email })).toEqual([{ provider: "google", subject: "g-123", email: "g-123@example.org" }]);
    expect((await acts()).at(-1)).toEqual({ action: "me.connect", after: { provider: "google" } });
  });

  it("a token endpoint error or an id_token with the wrong nonce signs in nobody", async () => {
    await realProviders(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect((await callback("google", { code: "c", state: (await realStart("google")).state })).status).toBe(401);
    restore.forEach((r) => r());
    restore = [];
    await realProviders(async () => Response.json({ access_token: "a", token_type: "Bearer", id_token: await idToken("google", { sub: "mock-google-demo", nonce: "not-the-stored-one" }) }));
    expect((await callback("google", { code: "c", state: (await realStart("google")).state })).status).toBe(401);
    expect(await count("sessions")).toBe(0);
  });
});

describe("GET /v1/auth/providers", () => {
  it("names the providers that can sign in: the mock enables both, else the configured ones", async () => {
    const providers = async () => (await (call("GET", "/v1/auth/providers") as Promise<Res>)).json();
    expect<unknown>(await providers()).toEqual({ google: true, apple: true });
    const cfg = spyOn(conf, "config").mockReturnValue({ ...conf.config(), OAUTH_MOCK: false });
    try {
      expect<unknown>(await providers()).toEqual({ google: false, apple: false });
      cfg.mockReturnValue({ ...conf.config(), OAUTH_MOCK: false, GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" });
      expect<unknown>(await providers()).toEqual({ google: true, apple: false });
    } finally {
      cfg.mockRestore();
    }
  });
});
