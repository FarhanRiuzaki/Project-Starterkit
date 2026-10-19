import { describe, expect, it } from "vitest";
import { csrfOk, newCsrfToken, secureEquals } from "./csrf";

describe("csrf", () => {
  it("tokens are 32 random bytes in base64url", () => {
    const a = newCsrfToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newCsrfToken()).not.toBe(a);
  });
  it("accepts only the exact session token", () => {
    const t = newCsrfToken();
    expect(csrfOk(t, t)).toBe(true);
    expect(csrfOk(null, t)).toBe(false);
    expect(csrfOk(t, undefined)).toBe(false);
    expect(csrfOk(t.slice(1), t)).toBe(false);
    expect(csrfOk("", "")).toBe(false);
    expect(secureEquals("abc", "abd")).toBe(false);
  });
});
