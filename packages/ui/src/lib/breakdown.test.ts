import { describe, expect, it } from "vitest";
import { breakdown, OTHER_ID, rowLimit } from "./breakdown";

const p = (label: string, value: number, slot?: number) => ({ label, value, slot });
const view = (parts: Parameters<typeof breakdown>[0], max?: number) => breakdown(parts, "Everything else", max);

describe("breakdown (BreakdownCard rows)", () => {
  it("ranks the parts largest first and keeps each part's colour slot (input position unless given)", () => {
    const d = view([p("Viewer", 12), p("Admin", 30), p("Owner", 3, 5)]);
    expect(d.total).toBe(45);
    expect(d.rows.map((r) => [r.label, r.value, r.slot])).toEqual([["Admin", 30, 1], ["Viewer", 12, 0], ["Owner", 3, 5]]);
  });
  it("equal values keep the caller's order", () => {
    expect(view([p("B", 5), p("A", 5), p("C", 9)]).rows.map((r) => r.label)).toEqual(["C", "B", "A"]);
  });
  it("more parts than max: max − 1 largest, the rest in one last row with the caller's label and no slot", () => {
    const d = view([p("A", 48), p("B", 27), p("C", 15), p("D", 6), p("E", 4)], 4);
    expect(d.rows.map((r) => [r.id, r.label, r.value, r.slot])).toEqual([["A", "A", 48, 0], ["B", "B", 27, 1], ["C", "C", 15, 2], [OTHER_ID, "Everything else", 10, null]]);
    expect(d.total).toBe(100);
  });
  it("the folded row stays last even when it is larger than a named part", () => {
    expect(view([p("A", 10), p("B", 4), p("C", 4), p("D", 4)], 2).rows.map((r) => [r.label, r.value])).toEqual([["A", 10], ["Everything else", 12]]);
  });
  it("exactly max parts are not folded", () => {
    expect(view([p("A", 3), p("B", 2), p("C", 1)], 3).rows.map((r) => r.id)).toEqual(["A", "B", "C"]);
  });
  it("shares are whole percentages that sum to 100; a visible part under 0.5% reads <1%", () => {
    expect(view([p("A", 1), p("B", 1), p("C", 1)]).rows.map((r) => r.shareText)).toEqual(["34%", "33%", "33%"]);
    const tiny = view([p("A", 999), p("B", 1)]);
    expect(tiny.rows.map((r) => r.shareText)).toEqual(["100%", "<1%"]);
    expect(tiny.rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1);
  });
  it("zero, negative and non-finite parts are left out of the rows and the total", () => {
    const d = view([p("A", 0), p("B", -4), p("C", Number.NaN), p("D", Number.POSITIVE_INFINITY), p("E", 8)]);
    expect(d).toEqual({ total: 8, ids: ["E"], rows: [{ id: "E", label: "E", value: 8, slot: 4, share: 1, shareText: "100%" }] });
  });
  it("nothing to show: no rows, total 0", () => {
    expect(view([])).toEqual({ total: 0, ids: [], rows: [] });
    expect(view([p("A", 0), p("B", -1)])).toEqual({ total: 0, ids: [], rows: [] });
  });
  it("id is the part's own id, else its label", () => {
    expect(view([{ id: "m-1", label: "Password", value: 2 }, p("Google", 1)]).rows.map((r) => r.id)).toEqual(["m-1", "Google"]);
  });
  it("max is held to 2…6 rows (six colour slots)", () => {
    expect([0, 1, 2, 5, 6, 9, 2.9].map(rowLimit)).toEqual([2, 2, 2, 5, 6, 6, 2]);
    const eight = Array.from({ length: 8 }, (_, i) => p(`p${i}`, 8 - i));
    expect(view(eight, 20).rows.map((r) => r.id)).toEqual(["p0", "p1", "p2", "p3", "p4", OTHER_ID]);
    expect(view(eight, 1).rows.map((r) => r.id)).toEqual(["p0", OTHER_ID]);
    expect(view(eight).rows).toHaveLength(5);
  });
  it("a max that is not a number falls back to the default 5; an infinite one is held like any other", () => {
    expect([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map(rowLimit)).toEqual([5, 6, 2]);
    const eight = Array.from({ length: 8 }, (_, i) => p(`p${i}`, 8 - i));
    expect(view(eight, Number.NaN).rows.map((r) => r.id)).toEqual(["p0", "p1", "p2", "p3", OTHER_ID]);
  });
  it("ids: every counted part, largest first, the folded ones included (what the new-row wash compares)", () => {
    const d = view([p("A", 48), p("B", 0), p("C", 15), p("D", 6), p("E", 27)], 3);
    expect(d.rows.map((r) => r.id)).toEqual(["A", "E", OTHER_ID]);
    expect(d.ids).toEqual(["A", "E", "C", "D"]);
  });
  it("more than six parts without a slot: no two named rows share a colour; the first six keep their own", () => {
    const d = view([100, 5, 4, 3, 2, 1, 90, 80].map((v, i) => p(`P${i}`, v)), 4);
    expect(d.rows.map((r) => [r.id, r.slot])).toEqual([["P0", 0], ["P6", 1], ["P7", 2], [OTHER_ID, null]]);
    // Positions 3 and 9 both default to slot 3: the earlier part keeps it, whatever the rank.
    const late = view([1, 1, 1, 50, 1, 1, 1, 1, 1, 60].map((v, i) => p(`P${i}`, v)), 3);
    expect(late.rows.map((r) => [r.id, r.slot])).toEqual([["P9", 0], ["P3", 3], [OTHER_ID, null]]);
  });
  it("a slot the caller gave stays as given; a defaulted one that meets it moves to a free slot", () => {
    expect(view([p("A", 10), p("B", 9, 0), p("C", 8, 7)]).rows.map((r) => [r.id, r.slot])).toEqual([["A", 2], ["B", 0], ["C", 7]]);
  });
});
