import { describe, expect, it } from "vitest";
import { clampPage, PAGE_SIZE, pageCount, pageWindow, rangeLabel } from "./paging";

describe("paging", () => {
  it("default page size 25", () => expect(PAGE_SIZE).toBe(25));

  it("pageCount: minimal 1, pembulatan ke atas", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(312, 25)).toBe(13);
  });

  it("pageCount: input rusak aman", () => {
    expect(pageCount(Number.NaN, 25)).toBe(1);
    expect(pageCount(-5, 25)).toBe(1);
    expect(pageCount(100, 0)).toBe(1);
    expect(pageCount(Number.POSITIVE_INFINITY, 25)).toBe(1);
  });

  it("clampPage: batas bawah, atas, NaN, pecahan", () => {
    expect(clampPage(0, 312, 25)).toBe(1);
    expect(clampPage(-3, 312, 25)).toBe(1);
    expect(clampPage(99, 312, 25)).toBe(13);
    expect(clampPage(Number.NaN, 312, 25)).toBe(1);
    expect(clampPage(2.7, 312, 25)).toBe(2);
    expect(clampPage(5, 0, 25)).toBe(1);
  });


  it('rangeLabel: en dash + "of"', () => {
    expect(rangeLabel(1, 25, 312)).toBe("1–25 of 312");
    expect(rangeLabel(13, 25, 312)).toBe("301–312 of 312");
    expect(rangeLabel(99, 25, 312)).toBe("301–312 of 312");
    expect(rangeLabel(2, 25, 1234)).toBe("26–50 of 1,234");
    expect(rangeLabel(1, 25, 0)).toBe("0 of 0");
    expect(rangeLabel(1, 25, 7)).toBe("1–7 of 7");
  });
});

describe("pageWindow (pagination buttons)", () => {
  it("shows every page up to 7", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("first, last, current ± 1, gaps for skipped runs", () => {
    expect(pageWindow(1, 13)).toEqual([1, 2, 3, "gap", 13]);
    expect(pageWindow(7, 13)).toEqual([1, "gap", 6, 7, 8, "gap", 13]);
    expect(pageWindow(13, 13)).toEqual([1, "gap", 11, 12, 13]);
  });
  it("a gap of one page shows the page instead", () => {
    expect(pageWindow(4, 13)).toEqual([1, 2, 3, 4, 5, "gap", 13]);
    expect(pageWindow(10, 13)).toEqual([1, "gap", 9, 10, 11, 12, 13]);
  });
  it("clamps bad input", () => {
    expect(pageWindow(99, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(Number.NaN, 0)).toEqual([1]);
  });
});

describe("showingLabel", () => {
  it("'Showing a–b of n', with a '+' when the server capped the count", async () => {
    const { showingLabel } = await import("./paging");
    expect(showingLabel(1, 15, 12_345)).toBe("Showing 1–15 of 12,345");
    expect(showingLabel(824, 15, 12_345)).toBe("Showing 12,331–12,345 of 12,345"); // past the end: clamped to the last page
    expect(showingLabel(2, 15, 100_000, true)).toBe("Showing 16–30 of 100,000+");
    expect(showingLabel(1, 15, 0)).toBe("Showing 0 of 0");
  });
});
