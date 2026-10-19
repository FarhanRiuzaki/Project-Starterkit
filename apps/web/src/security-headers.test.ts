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
  it("HSTS only when served over HTTPS (COOKIE_SECURE)", () => {
    expect(securityHeaders({ nonce: "x", secure: true })["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
  });
});
