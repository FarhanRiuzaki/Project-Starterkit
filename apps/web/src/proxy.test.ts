import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const call = (path: string, headers: Record<string, string> = {}) => proxy(new NextRequest(`http://c:3000${path}`, { headers }));
const forwarded = (r: Response, name: string) => r.headers.get(`x-middleware-request-${name}`);

describe("proxy", () => {
  it("every request passes through with the nonce CSP and the security headers", () => {
    for (const p of ["/", "/users", "/login", "/api/users"]) {
      const r = call(p);
      expect(r.headers.get("x-middleware-next"), p).toBe("1");
      expect(r.headers.get("x-middleware-rewrite"), p).toBeNull();
      const csp = r.headers.get("Content-Security-Policy")!;
      const nonce = forwarded(r, "x-nonce")!;
      expect(csp, p).toContain(`'nonce-${nonce}'`);
      expect(forwarded(r, "content-security-policy"), p).toBe(csp);
      expect(r.headers.get("X-Frame-Options")).toBe("DENY");
      expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(r.headers.get("Strict-Transport-Security")).toBeNull();
    }
  });

  it("a fresh nonce per request", () => {
    expect(forwarded(call("/"), "x-nonce")).not.toBe(forwarded(call("/"), "x-nonce"));
  });

  it("x-pathname (the sign-in deep link) drops the client router's _rsc parameter", () => {
    expect(forwarded(call("/users?page=2&_rsc=abc"), "x-pathname")).toBe("/users?page=2");
    expect(forwarded(call("/users?_rsc=1"), "x-pathname")).toBe("/users");
  });

  it("raw path tricks reach x-pathname as the page they name", () => {
    for (const [raw, want] of [["/me/../users", "/users"], ["/me/%2e%2e/users", "/users"], ["/me/%2E%2E/roles", "/roles"], ["/api/../audit", "/audit"]]) {
      expect(forwarded(call(raw!), "x-pathname"), raw).toBe(want);
    }
  });

  it("a client-sent x-pathname or x-nonce is overwritten", () => {
    const r = call("/users", { "x-pathname": "//evil.com", "x-nonce": "mine" });
    expect(forwarded(r, "x-pathname")).toBe("/users");
    expect(forwarded(r, "x-nonce")).not.toBe("mine");
  });
});
