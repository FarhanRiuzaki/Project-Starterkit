import { describe, expect, it } from "vitest";
import { calendarDays, calendarKey, moveMonth, validDate } from "./calendar";
describe("calendar dates", () => {
  it("validates real dates and leap years", () => { expect(validDate("2024-02-29")).toBe(true); expect(validDate("2026-02-29")).toBe(false); expect(validDate("2026-2-3")).toBe(false); });
  it("starts on Monday and spans six complete weeks across years", () => { const days = calendarDays("2027-01-01"); expect(days).toHaveLength(42); expect(days[0]).toBe("2026-12-28"); expect(days[41]).toBe("2027-02-07"); });
  it("clamps month and year navigation", () => { expect(moveMonth("2024-01-31", 1)).toBe("2024-02-29"); expect(moveMonth("2024-02-29", 12)).toBe("2025-02-28"); expect(moveMonth("2026-01-31", -1)).toBe("2025-12-31"); });
  it("supports day, week, month and year keyboard navigation", () => { expect(calendarKey("2026-11-08", "Home")).toBe("2026-11-02"); expect(calendarKey("2026-11-08", "ArrowRight")).toBe("2026-11-09"); expect(calendarKey("2026-11-08", "End")).toBe("2026-11-08"); expect(calendarKey("2024-02-29", "PageDown", true)).toBe("2025-02-28"); expect(calendarKey("2026-11-08", "Tab")).toBeNull(); });
});
