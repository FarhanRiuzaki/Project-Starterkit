import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE, formatBudgetLeft, formatBytes, formatCompact, formatDateTime, formatDate, formatDecimal, plural, formatDateTimeLong, formatDuration, formatNumber, formatPercent, formatRelative, formatSignedNumber, formatSignedPercent, formatTime, secondsSinceMidnight,
} from "./format";

describe("format", () => {
  it("formats numbers in en-GB", () => {
    expect(formatNumber(180000)).toBe("180,000");
    expect(formatNumber(null)).toBe("–");
  });
  it("formats bytes with binary units", () => {
    expect(formatBytes(412 * 1024 * 1024)).toBe("412 MB");
    expect(formatBytes(4 * 1024 ** 3)).toBe("4 GB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.5 GB");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(0.25)).toBe("0.3 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(undefined)).toBe("–");
  });
  it("formats percent", () => {
    expect(formatPercent(0.034)).toBe("3%");
    expect(formatPercent(null)).toBe("–");
  });
  it("formats percent with up to `digits` decimals (SLO objectives and error rates)", () => {
    expect(formatPercent(0.995, 2)).toBe("99.5%");
    expect(formatPercent(0.0021, 2)).toBe("0.21%");
    expect(formatPercent(0.999, 2)).toBe("99.9%");
    expect(formatPercent(1, 2)).toBe("100%");
    expect(formatPercent(0.62)).toBe("62%");
    expect(formatPercent(Number.NaN, 2)).toBe("–");
  });
  it("budget left never rounds a non-empty budget to 0% or a spent one to 100%", () => {
    expect(formatBudgetLeft(0.95)).toBe("95% left");
    expect(formatBudgetLeft(0.004)).toBe("<1% left");
    expect(formatBudgetLeft(0.0001)).toBe("<1% left");
    expect(formatBudgetLeft(0)).toBe("0% left");
    expect(formatBudgetLeft(-0.3)).toBe("0% left");
    expect(formatBudgetLeft(0.996)).toBe(">99% left");
    expect(formatBudgetLeft(0.9999)).toBe(">99% left");
    expect(formatBudgetLeft(1)).toBe("100% left");
    expect(formatBudgetLeft(1.2)).toBe("100% left");
    expect(formatBudgetLeft(0.005)).toBe("1% left");
    expect(formatBudgetLeft(null)).toBe("–");
    expect(formatBudgetLeft(Number.NaN)).toBe("–");
  });
  it("formats durations", () => {
    expect(formatDuration(30)).toBe("<1 min");
    expect(formatDuration(5 * 60)).toBe("5 min");
    expect(formatDuration(2 * 3600 + 31 * 60)).toBe("2 h 31 min");
    expect(formatDuration(26 * 3600)).toBe("1 d 2 h");
    expect(formatDuration(null)).toBe("–");
  });
  it("formats time in Asia/Jakarta", () => {
    expect(formatTime(Date.UTC(2026, 9, 15, 5, 27))).toBe("12:27");
  });
  it("formats relative time", () => {
    const now = Date.UTC(2026, 9, 15, 12, 0);
    expect(formatRelative(now - 20_000, now)).toBe("Just now");
    expect(formatRelative(now - 90_000, now)).toBe("1 min ago");
    expect(formatRelative(now - 3 * 3600_000, now)).toBe("3 h ago");
    expect(formatRelative(now - 30 * 3600_000, now)).toBe("Yesterday");
    expect(formatRelative(now - 3 * 86_400_000, now)).toBe("3 days ago");
    expect(formatRelative(now + 60_000, now)).toBe("Just now");
    expect(formatRelative(null, now)).toBe("Never");
  });
  it("counts seconds since midnight WIB, minimum 60", () => {
    expect(secondsSinceMidnight(Date.UTC(2026, 9, 15, 0, 30))).toBe(7 * 3600 + 30 * 60);
    expect(secondsSinceMidnight(Date.UTC(2026, 9, 14, 17, 0, 10))).toBe(60);
  });
});

describe("format enterprise", () => {
  it("compacts numbers as K / M / B", () => {
    expect(formatCompact(1284)).toBe("1,284");
    expect(formatCompact(9999)).toBe("9,999");
    expect(formatCompact(12_900)).toBe("12.9K");
    expect(formatCompact(4_600_000)).toBe("4.6M");
    expect(formatCompact(2_300_000_000)).toBe("2.3B");
    expect(formatCompact(-12_900)).toBe("−12.9K");
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(999_950)).toBe("1M");
    expect(formatCompact(999_999_999)).toBe("1B");
    expect(formatCompact(9_999.6)).toBe("10K");
    expect(formatCompact(-999_950)).toBe("−1M");
  });
  it("invalid values become an en dash", () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) expect(formatCompact(v)).toBe("–");
    expect(formatDateTimeLong(null)).toBe("–");
    expect(formatSignedPercent(Number.NaN)).toBe("–");
    expect(formatSignedNumber(null)).toBe("–");
  });
  it("signed count for a stat tile delta", () => {
    expect(formatSignedNumber(3)).toBe("+3");
    expect(formatSignedNumber(-1250)).toBe("−1,250");
    expect(formatSignedNumber(0)).toBe("0");
  });
  it("long date-time in WIB", () => {
    expect(formatDateTimeLong(Date.UTC(2026, 9, 16, 7, 5))).toBe("16 Oct 2026, 14:05 WIB");
    expect(formatDateTimeLong(Date.UTC(2026, 7, 1, 17, 0))).toBe("2 Aug 2026, 00:00 WIB");
    // en-GB writes "Sept"; the house format uses three-letter months.
    expect(formatDateTimeLong(Date.UTC(2026, 8, 16, 7, 5))).toBe("16 Sep 2026, 14:05 WIB");
  });
  it("short date and date-time in WIB", () => {
    expect(formatDate(Date.UTC(2026, 8, 15, 18, 0))).toBe("16 Sep");
    expect(formatDateTime(Date.UTC(2026, 9, 16, 7, 5))).toBe("16 Oct, 14:05");
    expect(formatDate(null)).toBe("–");
  });
  it("signed percent uses the typographic minus", () => {
    expect(formatSignedPercent(0.184)).toBe("+18%");
    expect(formatSignedPercent(-0.04)).toBe("−4%");
    expect(formatSignedPercent(0)).toBe("0%");
  });
});

describe("formatDecimal / plural", () => {
  it("caps decimals and handles invalid input", () => {
    expect(formatDecimal(2.456, 1)).toBe("2.5");
    expect(formatDecimal(1.23456, 4)).toBe("1.2346");
    expect(formatDecimal(1234.5, 1)).toBe("1,234.5");
    expect(formatDecimal(3, 2)).toBe("3");
    expect(formatDecimal(null, 1)).toBe("–");
    expect(formatDecimal(Number.NaN, 2)).toBe("–");
  });
  it("agrees the noun with the count", () => {
    expect(plural(1, "session", "sessions")).toBe("1 session");
    expect(plural(0, "session", "sessions")).toBe("0 sessions");
    expect(plural(3, "entry", "entries")).toBe("3 entries");
    expect(plural(null, "developer", "developers")).toBe("– developers");
  });
});

describe("APP_TIME_ZONE", () => {
  it("is Asia/Jakarta, the zone every time formatter uses", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Jakarta");
    expect(formatDateTimeLong(Date.UTC(2026, 9, 15, 17, 30))).toBe("16 Oct 2026, 00:30 WIB");
  });
});

describe("app-time-zone calendar days", () => {
  it("appDate is the calendar date in the app time zone", async () => {
    const { appDate } = await import("./format");
    expect(appDate(Date.UTC(2026, 9, 19, 16, 59, 59))).toBe("2026-10-19");
    expect(appDate(Date.UTC(2026, 9, 19, 17, 0, 0))).toBe("2026-10-20");
  });

  it("appDayStart is 00:00 of that date in the app time zone; shiftDate moves whole days across months", async () => {
    const { appDayStart, shiftDate } = await import("./format");
    expect(appDayStart("2026-10-20")).toBe(Date.UTC(2026, 9, 19, 17, 0, 0));
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});
