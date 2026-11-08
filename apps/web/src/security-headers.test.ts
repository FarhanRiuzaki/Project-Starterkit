import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("securityHeaders", () => {
  it("nonce CSP, no framing, device APIs denied, COOP same-origin", () => {
    const h = securityHeaders({ nonce: "abc", secure: false });
    expect(h["Content-Security-Policy"]).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\), microphone=\(\), geolocation=\(\)/);
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h).not.toHaveProperty("Strict-Transport-Security");
  });
  it("allows React debugging eval only in development, keeping production strict", () => {
    const development = securityHeaders({ nonce: "dev", secure: false, development: true })["Content-Security-Policy"]!;
    expect(development).toContain("'unsafe-eval'");
    expect(development).toContain("'strict-dynamic'");
    expect(development).toContain("'nonce-dev'");
    for (const production of [securityHeaders({ nonce: "prod", secure: true }), securityHeaders({ nonce: "prod", secure: true, development: false })]) {
      expect(production["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    }
  });
  it("HSTS only when served over HTTPS (COOKIE_SECURE)", () => {
    expect(securityHeaders({ nonce: "x", secure: true })["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
  });
});
