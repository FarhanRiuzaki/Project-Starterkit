import { describe, expect, it } from "bun:test";
import { isTotpCode, oauthOnly, twoFactorPath } from "../../rules";

describe("sign-in rules", () => {
  it("oauthOnly: no password and not a directory user", () => {
    expect(oauthOnly({ passwordHash: null, isLdap: false })).toBe(true);
    expect(oauthOnly({ passwordHash: "$argon2id$x", isLdap: false })).toBe(false);
    expect(oauthOnly({ passwordHash: null, isLdap: true })).toBe(false);
  });

  it("isTotpCode: exactly six digits; a recovery code or anything else is not", () => {
    expect(isTotpCode("012345")).toBe(true);
    for (const c of ["12345", "1234567", "aaaa-1111", "12345a", " 123456", "123456\n", "１２３４５６"]) expect(isTotpCode(c), c).toBe(false);
  });

  it("twoFactorPath: the code page, with next unless it is the home page", () => {
    expect(twoFactorPath("/")).toBe("/login/2fa");
    expect(twoFactorPath("/users?page=2")).toBe("/login/2fa?next=%2Fusers%3Fpage%3D2");
  });
});
