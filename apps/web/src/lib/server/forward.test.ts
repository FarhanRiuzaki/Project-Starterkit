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
import { INTERNAL_COPY } from "./backend";
import { forward } from "./forward";
import { log } from "./logger";

const at = (path: string, init: RequestInit = {}) => forward(new Request(`http://c${path}`, init));
const errorOf = async (r: Response) => ((await r.json()) as { error: { code: string; message: string } }).error;
const ok = () => Response.json({ ok: true });

beforeEach(() => jar.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("forward (app/api/[...path])", () => {
  it("mutation with a session and no x-csrf-token is 403 csrf and never reaches the API", async () => {
    const seen = fakeApi(ok);
    await sealCookie(jar);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      for (const h of [{}, { "x-csrf-token": "wrong" }, { "x-csrf-token": TEST_CSRF.slice(1) + "d" }] as Record<string, string>[]) {
        const r = await at("/api/users", { method, headers: h });
        expect(r.status, `${method} ${JSON.stringify(h)}`).toBe(403);
        expect((await errorOf(r)).code).toBe("csrf");
      }
    }
    expect(seen).toEqual([]);
    expect((await at("/api/users", { method: "POST", headers: { "x-csrf-token": TEST_CSRF } })).status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it("GET without a session is forwarded without Authorization", async () => {
    const seen = fakeApi(() => Response.json({ error: { code: "unauthenticated", message: "Sign in to continue." } }, { status: 401 }));
    const r = await at("/api/users?page=2&q=a%20b");
    expect(r.status).toBe(401);
    expect(pathOf(seen[0]!)).toBe("/v1/users?page=2&q=a%20b");
    expect(seen[0]!.headers.get("authorization")).toBeNull();
    expect(seen[0]!.headers.get("x-internal-token")).toBe(process.env.INTERNAL_API_TOKEN);
    // A mutation without a session has no CSRF token to check: the API answers its 400 or 401.
    expect((await at("/api/users", { method: "POST", body: "{}" })).status).toBe(401);
    expect(seen[1]!.headers.get("authorization")).toBeNull();
  });

  it("forwards the query, the JSON body and the session token", async () => {
    const seen = fakeApi(() => Response.json({ id: "x" }, { status: 201 }));
    await sealCookie(jar);
    const r = await at("/api/roles?x=1", { method: "POST", headers: { "x-csrf-token": TEST_CSRF, "content-type": "application/json" }, body: '{"name":"Ops"}' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: "x" });
    const sent = seen[0]!;
    expect([sent.method, pathOf(sent), sent.headers.get("authorization"), sent.headers.get("content-type")])
      .toEqual(["POST", "/v1/roles?x=1", `Bearer ${TEST_TOKEN}`, "application/json"]);
    expect(await sent.text()).toBe('{"name":"Ops"}');
    expect(sent.headers.get("x-csrf-token")).toBeNull(); // the CSRF token stays in Next
  });

  it("API 401 clears the cookie", async () => {
    fakeApi(() => Response.json({ error: { code: "unauthenticated", message: "Sign in to continue." } }, { status: 401 }));
    await sealCookie(jar);
    expect((await at("/api/me")).status).toBe(401);
    expect(await cookieOf(jar)).toBeNull();
    // A sign-in waiting for its second factor keeps its cookie (it can still finish or cancel).
    await sealCookie(jar, { challenge: "ch" });
    expect((await at("/api/me")).status).toBe(401);
    expect(await cookieOf(jar)).toEqual({ challenge: "ch" });
  });

  it("`/api/../v1` and `%2e%2e` paths are 404", async () => {
    const seen = fakeApi(ok);
    await sealCookie(jar);
    for (const p of ["/api/../v1/users", "/api/%2e%2e/v1/users", "/api/users%2F..%2Fdashboard", "/api/users/a.b",
      "/api/Users", "/api/users/%ZZ", "/api/", "/api/auth/oauth/google/mock-login", "/api/auth/context", "/v1/users"]) {
      const r = await at(p);
      expect(r.status, p).toBe(404);
      expect((await errorOf(r)).code, p).toBe("not_found");
    }
    expect(seen).toEqual([]);
    // A dot segment inside /api/ resolves to the /api/ path it names (WHATWG URL), never above it.
    await at("/api/users/%2E%2E/roles");
    expect(seen.map(pathOf)).toEqual(["/v1/roles"]);
  });

  it("a 70 KB body is 400", async () => {
    const seen = fakeApi(ok);
    await sealCookie(jar);
    const big = JSON.stringify({ name: "x".repeat(70 * 1024) });
    for (const headers of [{ "x-csrf-token": TEST_CSRF }, { "x-csrf-token": TEST_CSRF, "content-length": "10" }] as Record<string, string>[]) {
      const r = await at("/api/roles", { method: "POST", headers, body: big });
      expect(r.status).toBe(400);
      expect((await errorOf(r)).code).toBe("bad_request");
    }
    expect(seen).toEqual([]);
    expect((await at("/api/roles", { method: "POST", headers: { "x-csrf-token": TEST_CSRF }, body: "x".repeat(64 * 1024) })).status).toBe(200);
  });

  it("CSV passes through with Content-Disposition", async () => {
    const csv = "﻿at,actor\n2026-10-20,Admin\n";
    fakeApi(() => new Response(csv, { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="activity-2026-10-20.csv"',
      "Cache-Control": "no-store", "Set-Cookie": "x=1", "X-Powered-By": "api",
    } }));
    await sealCookie(jar);
    const r = await at("/api/audit/activity?format=csv");
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.clone().arrayBuffer())).toEqual(new TextEncoder().encode(csv));
    expect(Object.fromEntries(r.headers)).toEqual({
      "cache-control": "no-store", "content-disposition": 'attachment; filename="activity-2026-10-20.csv"', "content-type": "text/csv; charset=utf-8",
    });
  });

  it("429 keeps its Retry-After", async () => {
    fakeApi(() => Response.json({ error: { code: "rate_limited", message: "Try again in 40 seconds." } }, { status: 429, headers: { "Retry-After": "40" } }));
    await sealCookie(jar);
    const r = await at("/api/me/password", { method: "POST", headers: { "x-csrf-token": TEST_CSRF }, body: "{}" });
    expect([r.status, r.headers.get("retry-after")]).toEqual([429, "40"]);
  });

  it("API down → 500 internal fixed copy", async () => {
    vi.spyOn(log, "error").mockImplementation(() => undefined);
    fakeApi(() => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }); });
    await sealCookie(jar);
    const r = await at("/api/users");
    expect(r.status).toBe(500);
    expect(await errorOf(r)).toEqual({ code: "internal", message: INTERNAL_COPY });
    expect(await cookieOf(jar)).not.toBeNull();
  });
});
