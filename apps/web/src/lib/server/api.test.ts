import { describe, expect, it, vi } from "vitest";

const SECRET = vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));

import { apiError, clientIp, json, sameOrigin } from "./api";
import { sessionOptions } from "./session";

describe("session cookie", () => {
  it("httpOnly, sameSite strict, secure follows COOKIE_SECURE, ttl = hours × 3600", () => {
    for (const secure of [true, false]) {
      const o = sessionOptions({ SESSION_SECRET: SECRET, SESSION_TTL_HOURS: 5, COOKIE_SECURE: secure, API_BASE_URL: "http://a", INTERNAL_API_TOKEN: "t".repeat(32), APP_URL: "http://w", OAUTH_MOCK: false });
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

describe("sameOrigin", () => {
  // The standalone server binds HOSTNAME=0.0.0.0, so the request URL names the bind address, never the site.
  const at = (headers: Record<string, string>) => new Request("http://0.0.0.0:3000/api/auth/login", { method: "POST", headers });
  const APP = "http://localhost:3001";

  it("Sec-Fetch-Site same-origin or none passes; else the Origin must be APP_URL's origin, whatever the request URL says", () => {
    expect(sameOrigin(at({ "sec-fetch-site": "same-origin" }), false, APP)).toBe(true);
    expect(sameOrigin(at({ "sec-fetch-site": "none" }), false, APP)).toBe(true);
    expect(sameOrigin(at({ origin: APP }), false, APP)).toBe(true); // a client that sends no Sec-Fetch-Site
    expect(sameOrigin(at({ origin: APP }), false, `${APP}/`)).toBe(true);
    expect(sameOrigin(at({ origin: "http://0.0.0.0:3000" }), false, APP)).toBe(false); // the bind address isn't the site
    expect(sameOrigin(at({ origin: "https://evil.example" }), false, APP)).toBe(false);
    expect(sameOrigin(at({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }), false, APP)).toBe(false);
    expect(sameOrigin(at({}), false, APP)).toBe(false);
  });

  it("behind a proxy (TRUSTED_PROXY=true) X-Forwarded-Host (and -Proto) name the origin too; without it they are ignored", () => {
    const proxied = { origin: "https://app.example.com", "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https" };
    expect(sameOrigin(at(proxied), true, APP)).toBe(true);
    expect(sameOrigin(at(proxied), false, APP)).toBe(false);
    expect(sameOrigin(at({ origin: "https://evil.example", "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https" }), true, APP)).toBe(false);
    expect(sameOrigin(at({ origin: APP }), true, APP)).toBe(true); // no forwarded host: APP_URL
  });
});
