import { describe, expect, it } from "bun:test";
import { decryptSecret, encryptSecret, hashToken, randomToken, safeEqual } from "../../crypto";

describe("crypto", () => {
  it("round-trips a secret", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(enc).toMatch(/^v1:[\w-]{16}:[\w-]{22}:[\w-]+$/);
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(encryptSecret("JBSWY3DPEHPK3PXP")).not.toBe(enc); // fresh IV each time
    expect(decryptSecret(enc)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("a tampered ciphertext throws", () => {
    const [v, iv, tag, ct] = encryptSecret("JBSWY3DPEHPK3PXP").split(":") as [string, string, string, string];
    const flipped = Buffer.from(ct, "base64url");
    flipped[0]! ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join(":"))).toThrow();
    expect(() => decryptSecret([v, iv, tag.slice(0, 8), ct].join(":"))).toThrow(); // truncated tag
  });

  it("unknown version throws", () => {
    const enc = encryptSecret("x");
    expect(() => decryptSecret(enc.replace(/^v1:/, "v2:"))).toThrow();
    expect(() => decryptSecret("JBSWY3DPEHPK3PXP")).toThrow();
  });

  it("tokens are 32 random bytes, hashed with SHA-256; safeEqual compares", () => {
    const t = randomToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(randomToken()).not.toBe(t);
    expect(hashToken(t)).toHaveLength(32);
    expect(hashToken(t).equals(hashToken(t))).toBe(true);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
