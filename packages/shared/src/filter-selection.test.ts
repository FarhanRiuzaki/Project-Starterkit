import { describe, expect, it } from "vitest";
import { z } from "zod";
import { canonicalSelection, selectionState, selectionValues } from "./filter-selection";
import { filterSelection } from "./contracts/filter-selection";

describe("filter selections", () => {
  const names = filterSelection(z.string().min(1).max(64));
  it("canonicalizes exact values and roundtrips comma, Unicode and JSON-looking names without delimiter coercion", () => {
    const values = ["Design, Team", "日本", '["Admin"]', "Admin", "Admin", "admin"];
    expect(selectionValues(selectionState(values))).toEqual(canonicalSelection(values));
    expect(names.parse("Design, Team")).toEqual(["Design, Team"]);
    expect(names.parse('["Admin"]')).toEqual(['["Admin"]']);
    expect(names.parse("")).toEqual([]);
    expect(names.parse([])).toEqual([]);
  });
  it("validates all raw values before deduplication, including nested and non-string input", () => {
    expect(names.parse(Array(50).fill("Admin"))).toEqual(["Admin"]);
    for (const value of [Array(51).fill("Admin"), ["Admin", ""], [["Admin"]], [1], {}, null]) {
      expect(names.safeParse(value).success).toBe(false);
    }
    expect(filterSelection(z.enum(["active", "inactive"])).safeParse(["active", "invalid"]).success).toBe(false);
  });
});
