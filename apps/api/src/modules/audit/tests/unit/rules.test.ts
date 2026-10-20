import { describe, expect, it } from "bun:test";
import { MASK } from "@starterkit/shared/audit";
import { snapshot } from "../../rules";

describe("snapshot", () => {
  it("drops the row's own credential fields at any depth", () => {
    expect(snapshot({ id: "u1", passwordHash: "$argon2id$x", totpSecret: "v1:a", pendingTotpSecret: "v1:b", nested: { recoveryCodes: ["a"] } }))
      .toEqual({ id: "u1", nested: {} });
  });

  it("masks every other credential-named field that has a value; null stays null", () => {
    expect(snapshot({ password: "p", apiToken: null, after: { clientSecret: "s", recoveryCode: "aaaa-1111", label: "x" } }))
      .toEqual({ password: MASK, apiToken: null, after: { clientSecret: MASK, recoveryCode: MASK, label: "x" } });
  });

  it("no value is null; a non-object value is kept as JSON data", () => {
    expect(snapshot(undefined)).toBeNull();
    expect(snapshot(null)).toBeNull();
    expect(snapshot("plain")).toBe("plain");
    expect(snapshot(["a", 1])).toEqual(["a", 1]);
    expect(snapshot({ at: new Date("2026-01-02T03:04:05.000Z") })).toEqual({ at: "2026-01-02T03:04:05.000Z" });
  });
});
