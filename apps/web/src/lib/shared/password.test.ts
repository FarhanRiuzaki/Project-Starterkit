import { describe, expect, it } from "vitest";
import { Password } from "@starterkit/shared/contracts/password";
import { PASSWORD_MIN, passwordChecks } from "./password";

describe("passwordChecks", () => {
  it("uses the contract's minimum", () => {
    expect(Password.safeParse("x".repeat(PASSWORD_MIN)).success).toBe(true);
    expect(Password.safeParse("x".repeat(PASSWORD_MIN - 1)).success).toBe(false);
  });
  it("length: says how many are left while typing, ticks at the minimum", () => {
    expect(passwordChecks("")).toEqual([{ label: "At least 12 characters", met: false }]);
    expect(passwordChecks("abcdefg")).toEqual([{ label: "At least 12 characters (5 more)", met: false }]);
    expect(passwordChecks("abcdefghijkl")).toEqual([{ label: "At least 12 characters", met: true }]);
  });
  it("with a repeat field: the two must match, and an empty pair is not a match", () => {
    expect(passwordChecks("", "")[1]).toEqual({ label: "The two passwords match", met: false });
    expect(passwordChecks("abcdefghijkl", "abcdefghijk")[1]!.met).toBe(false);
    expect(passwordChecks("abcdefghijkl", "abcdefghijkl")[1]!.met).toBe(true);
  });
});
