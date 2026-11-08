import { describe, expect, it } from "vitest";
import { validDateRange, moveDateRange } from "./date-range";

describe("date ranges", () => {
  it("rejects impossible dates, incomplete and reversed ranges", () => {
    expect(validDateRange("2026-02-30", "2026-03-03")).toBe(false);
    expect(validDateRange("2026-01-02", "2026-01-01")).toBe(false);
    expect(validDateRange("", "2026-01-01")).toBe(false);
    expect(validDateRange("2026-01-01", "2026-04-30")).toBe(false);
    expect(validDateRange("2026-01-01", "2026-01-07")).toBe(true);
  });
  it("moves a full inclusive period across month and year boundaries", () => {
    expect(moveDateRange({ from: "2026-01-01", to: "2026-01-07" }, -1)).toEqual({ from: "2025-12-25", to: "2025-12-31" });
    expect(moveDateRange({ from: "2026-01-01", to: "2026-01-07" }, 1)).toEqual({ from: "2026-01-08", to: "2026-01-14" });
  });
});
