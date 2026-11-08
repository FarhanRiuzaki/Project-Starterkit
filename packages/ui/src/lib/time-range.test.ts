import { describe, expect, it } from "vitest";
import { isTimeExpression, moveTimeRange, parseTimeInput, resolveTime, resolveTimeRange, timeInputValue, timeRangeLabel } from "./time-range";
const now = Date.parse("2026-11-08T03:14:45.123Z");
describe("time range expressions", () => {
  it("resolves rolling minute ranges against one clock on every refresh", () => {
    const value = { start: "now-15m", end: "now" };
    expect(resolveTimeRange(value, now)).toEqual({ start: now - 900000, end: now });
    expect(resolveTimeRange(value, now + 30000)).toEqual({ start: now - 870000, end: now + 30000 });
    expect(timeRangeLabel(value)).toBe("Last 15 minutes");
  });
  it("rounds in the app zone, with Monday weeks and calendar-month clamping", () => {
    expect(new Date(resolveTime("now/d", now)!).toISOString()).toBe("2026-11-07T17:00:00.000Z");
    expect(new Date(resolveTime("now/w+1w", now)!).toISOString()).toBe("2026-11-08T17:00:00.000Z");
    expect(new Date(resolveTime("now-1M", Date.parse("2024-03-31T03:00:00Z"))!).toISOString()).toBe("2024-02-29T03:00:00.000Z");
    expect(resolveTime("now-15m/m", now)).toBe(now - 900000 - 45123);
  });
  it("accepts bounded absolute/relative ranges and rejects unsafe, empty or reversed expressions", () => {
    for (const value of ["now.constructor", "now-1.5h", "now-1q", "now-999999999999y", "2026-02-30T12:00:00Z"]) expect(isTimeExpression(value)).toBe(false);
    for (const value of [{ start: "now", end: "now" }, { start: "now", end: "now-1h" }, { start: "now-2y", end: "now" }]) expect(resolveTimeRange(value, now)).toBeNull();
    expect(resolveTimeRange({ start: "now-1y", end: "now" }, now)).not.toBeNull();
  });
  it("round-trips exact local timestamps and rejects normalized impossible values", () => {
    expect(timeInputValue(now)).toBe("2026-11-08 10:14:45.123");
    expect(parseTimeInput("2026-11-08 10:14:45.123")).toBe(new Date(now).toISOString());
    expect(parseTimeInput("2026-11-08 10:14")).toBe("2026-11-08T03:14:00.000Z");
    for (const value of ["2026-02-30 12:00", "2026-11-08 24:00", "2026-11-08 10:60"]) expect(parseTimeInput(value)).toBeNull();
  });
  it("steps an absolute interval by its actual duration", () => {
    expect(moveTimeRange({ start: "now-15m", end: "now" }, -1, now)).toEqual({ start: new Date(now - 1800000).toISOString(), end: new Date(now - 900000).toISOString() });
  });
});
