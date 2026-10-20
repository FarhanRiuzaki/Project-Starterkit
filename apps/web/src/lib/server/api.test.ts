import { describe, expect, it, vi } from "vitest";

const SECRET = vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));

import { apiError, clientIp, json, sameOrigin } from "./api";
import { sessionOptions } from "./session";

describe("session cookie", () => {
  it("httpOnly, sameSite strict, secure follows COOKIE_SECURE, ttl = hours × 3600", () => {
    for (const secure of [true, false]) {
      const o = sessionOptions({ SESSION_SECRET: SECRET, SESSION_TTL_HOURS: 5, COOKIE_SECURE: secure, API_BASE_URL: "http://a", INTERNAL_API_TOKEN: "t".repeat(32), OAUTH_MOCK: false });
      expect(o).toMatchObject({ cookieName: "sk_session", ttl: 5 * 3600, cookieOptions: { httpOnly: true, sameSite: "strict", secure, path: "/" } });
    }
  });
});

describe("responses", () => {
  it("json and apiError send no-store and the error shape", async () => {
    const r = apiError(404, "not_found", "No such user.");
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: { code: "not_found", message: "No such user." } });
    expect(json({}).headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("clientIp (sent to the API as X-Client-Ip)", () => {
  const r = (h: Record<string, string>) => new Request("http://c/api/auth/login", { headers: h });
  it("X-Forwarded-For is client-controlled and ignored without TRUSTED_PROXY: one shared bucket", () => {
    expect(clientIp(r({ "x-forwarded-for": "9.9.9.9" }), false)).toBe("unknown");
    expect(clientIp(r({}), false)).toBe("unknown");
  });
  it("TRUSTED_PROXY: the right-most XFF hop (what the trusted proxy saw), not a client-chosen first value", () => {
    expect(clientIp(r({ "x-forwarded-for": "6.6.6.6, 10.190.7.31" }), true)).toBe("10.190.7.31");
  });
});

describe("sameOrigin behind a proxy that rewrites Host", () => {
  const at = (headers: Record<string, string>) => new Request("http://127.0.0.1:3000/api/auth/login", { method: "POST", headers });

  it("X-Forwarded-Host (and -Proto) count only when TRUSTED_PROXY=true", () => {
    const proxied = { origin: "https://app.example.com", "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https" };
    expect(sameOrigin(at(proxied), true)).toBe(true);
    expect(sameOrigin(at(proxied), false)).toBe(false);
    expect(sameOrigin(at({ origin: "https://evil.example", "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https" }), true)).toBe(false);
    expect(sameOrigin(at({ origin: "http://127.0.0.1:3000" }), false)).toBe(true);
    expect(sameOrigin(at({ origin: "http://127.0.0.1:3000" }), true)).toBe(true); // no forwarded host: the request URL
  });
});
