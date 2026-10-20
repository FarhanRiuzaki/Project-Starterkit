import { describe, expect, it } from "bun:test";
import { newRecoveryCodes, newTotpSecret, otpauthUrl, totpCode, verifyTotp } from "../../totp";

const SECRET = "JBSWY3DPEHPK3PXP";
const NOW = 1_760_000_000_000; // a fixed instant, mid-step

describe("totp", () => {
  it("matches the RFC 6238 SHA-1 test vector", () => {
    // RFC 6238 appendix B: key "12345678901234567890" (base32 below), T = 59 s → 94287082 (8 digits).
    expect(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000, 8)).toBe("94287082");
  });

  it("verifyTotp accepts current and adjacent step, rejects others", () => {
    const at = (ms: number) => totpCode(SECRET, NOW + ms);
    expect(verifyTotp(SECRET, at(0), NOW)).toBe(true);
    expect(verifyTotp(SECRET, at(-30_000), NOW)).toBe(true);
    expect(verifyTotp(SECRET, at(30_000), NOW)).toBe(true);
    expect(verifyTotp(SECRET, at(-60_000), NOW)).toBe(false);
    expect(verifyTotp(SECRET, at(60_000), NOW)).toBe(false);
    expect(verifyTotp(SECRET, "12345", NOW)).toBe(false);
    expect(verifyTotp(SECRET, `${at(0)} `, NOW)).toBe(false);
    expect(verifyTotp(SECRET, "abcdef", NOW)).toBe(false);
  });

  it("newTotpSecret is random base32 (160 bits) and round-trips through verifyTotp", () => {
    const a = newTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(newTotpSecret()).not.toBe(a);
    expect(verifyTotp(a, totpCode(a, NOW), NOW)).toBe(true);
  });

  it("otpauthUrl carries issuer, account and secret", () => {
    const u = new URL(otpauthUrl(SECRET, "twofa@example.com", "Starterkit"));
    expect(u.protocol).toBe("otpauth:");
    expect(u.host).toBe("totp");
    expect(decodeURIComponent(u.pathname)).toBe("/Starterkit:twofa@example.com");
    expect(u.searchParams.get("secret")).toBe(SECRET);
    expect(u.searchParams.get("issuer")).toBe("Starterkit");
  });

  it("newRecoveryCodes: 8 distinct codes of 80 bits, lowercase base32 in groups of 4", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{4}$/); // 16 × 5 bits
  });
});
