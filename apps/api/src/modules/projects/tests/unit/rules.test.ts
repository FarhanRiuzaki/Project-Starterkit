import { describe, expect, it } from "bun:test";
import { projectChanges } from "../../rules";

const cur = { name: "Apollo", description: "Moon", status: "active" as const };

describe("projectChanges", () => {
  it("nothing sent, or the same values, is no change", () => {
    expect(projectChanges(cur, {})).toBeNull();
    expect(projectChanges(cur, { name: "Apollo", description: "Moon", status: "active" })).toBeNull();
  });

  it("lists only the changed fields, before and after", () => {
    expect(projectChanges(cur, { name: "Apollo", status: "archived" })).toEqual({ before: { status: "active" }, after: { status: "archived" } });
    expect(projectChanges(cur, { name: "apollo" })).toEqual({ before: { name: "Apollo" }, after: { name: "apollo" } });
  });

  it("an empty description clears it; clearing an empty one is no change", () => {
    expect(projectChanges(cur, { description: "" })).toEqual({ before: { description: "Moon" }, after: { description: null } });
    expect(projectChanges({ ...cur, description: null }, { description: "" })).toBeNull();
  });
});
