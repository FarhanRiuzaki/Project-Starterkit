import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("verifyPassword accepts the right password and rejects others", () => {
    const h = hashPassword("Password123!");
    expect(verifyPassword("Password123!", h)).toBe(true);
    expect(verifyPassword("password123!", h)).toBe(false);
    expect(verifyPassword("", h)).toBe(false);
  });
  it("salts each hash and rejects malformed hashes", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
    expect(verifyPassword("x", "garbage")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});
