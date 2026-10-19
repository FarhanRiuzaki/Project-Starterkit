import { describe, expect, it } from "vitest";
// @ts-expect-error: plain .mjs script without types
import { budgetFrom } from "../../scripts/bundle-budget.mjs";

describe("bundle-budget arguments", () => {
  it("reads --budget wherever it is; defaults to 250 kB", () => {
    expect(budgetFrom([], {})).toBe(250);
    expect(budgetFrom(["--json"], {})).toBe(250); // was NaN: the value after a missing --budget is args[0]
    expect(budgetFrom(["--json", "--budget", "180"], {})).toBe(180);
    expect(budgetFrom([], { BUNDLE_BUDGET_KB: "200" })).toBe(200);
  });
  it("refuses a budget that isn't a positive number (a NaN budget would pass every route)", () => {
    for (const a of [["--budget"], ["--budget", "abc"], ["--budget", "0"], ["--budget", "--json"]]) expect(() => budgetFrom(a, {}), a.join(" ")).toThrow(/budget/);
    expect(() => budgetFrom([], { BUNDLE_BUDGET_KB: "x" })).toThrow(/budget/);
  });
});
