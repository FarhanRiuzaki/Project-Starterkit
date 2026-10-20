import { describe, expect, it } from "bun:test";
import { LOCKS } from "../../locks";

describe("LOCKS", () => {
  it("every named lock has its own bigint key", () => {
    const keys = Object.values(LOCKS);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(typeof k).toBe("bigint");
  });

  it("names the sections the API serializes", () => {
    expect(Object.keys(LOCKS).sort()).toEqual(["catalog", "janitor", "migrations", "superadmin"]);
  });
});
