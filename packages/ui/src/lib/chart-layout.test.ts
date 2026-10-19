import { describe, expect, it } from "vitest";
import {
  annotationLayout, annotationRows, barPath, barRadius, barWidth, distribution, heatGrid, hourTickLabels, markersVisible, maxIndex,
  shareLabel, splitUnit, thresholdRows, tooltipPeriod,
} from "./chart-layout";

describe("bars (spec §6.3)", () => {
  it("cap radius = min(6, width/4)", () => {
    expect(barRadius(32)).toBe(6);
    expect(barRadius(16)).toBe(4);
    expect(barRadius(6)).toBe(1.5);
    expect(barRadius(0)).toBe(0);
  });
  it("width stays inside 6..32 and keeps the bar centred in its slot", () => {
    expect(barWidth(10, 40)).toEqual({ x: 14, width: 32 });
    expect(barWidth(10, 50)).toEqual({ x: 19, width: 32 });
    expect(barWidth(10, 4, 8)).toEqual({ x: 9, width: 6 });
    expect(barWidth(10, 20)).toEqual({ x: 10, width: 20 });
  });
  it("dense bands: the 6 px minimum never exceeds the slot, so bars cannot overlap", () => {
    expect(barWidth(10, 4, 4)).toEqual({ x: 10, width: 4 });
    expect(barWidth(10, 4, 5)).toEqual({ x: 9.5, width: 5 });
    expect(barWidth(10, 4)).toEqual({ x: 10, width: 4 });
  });
  it("path: value end rounded, baseline end 2 px", () => {
    expect(barPath(0, 10, 16, 40, 4, 2)).toBe("M0,48V14Q0,10 4,10H12Q16,10 16,14V48Q16,50 14,50H2Q0,50 0,48Z");
  });
  it("square corners when radius is 0", () => {
    expect(barPath(0, 0, 10, 10, 0, 0)).toBe("M0,10V0Q0,0 0,0H10Q10,0 10,0V10Q10,10 10,10H0Q0,10 0,10Z");
  });
  it("radii clamp to half the width and the height", () => {
    // 3 px tall bar: the value end keeps priority, the baseline end gets what is left.
    const d = barPath(0, 0, 16, 3, 6, 2);
    expect(d).toBe("M0,3V3Q0,0 3,0H13Q16,0 16,3V3Q16,3 16,3H0Q0,3 0,3Z");
  });
  it("zero or negative height → no path", () => {
    expect(barPath(0, 0, 10, 0, 4, 2)).toBe("");
    expect(barPath(0, 0, 10, -3, 4, 2)).toBe("");
    expect(barPath(0, 0, 0, 10, 4, 2)).toBe("");
  });
  it("direct label goes on the max bar only", () => {
    expect(maxIndex([3, 9, 9, 1])).toBe(1);
    expect(maxIndex([0, 0])).toBe(-1);
    expect(maxIndex([])).toBe(-1);
    expect(maxIndex([Number.NaN, 2])).toBe(1);
  });
});

describe("lines (spec §6.4)", () => {
  it("hollow markers only on series with ≤ 14 points", () => {
    expect(markersVisible(14)).toBe(true);
    expect(markersVisible(15)).toBe(false);
    expect(markersVisible(0)).toBe(false);
  });
});

describe("distribution (spec §6.5)", () => {
  it("shares in slot order, percentages sum to 100 (largest remainder)", () => {
    const d = distribution([{ label: "A", value: 1, slot: 0 }, { label: "B", value: 1, slot: 1 }, { label: "C", value: 1, slot: 2 }]);
    expect(d.total).toBe(3);
    expect(d.parts.map((p) => p.pct)).toEqual([34, 33, 33]);
    expect(d.parts.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1);
  });
  it("sorted by slot, not by value; Other last", () => {
    const d = distribution([{ label: "B", value: 9, slot: 1 }, { label: "A", value: 1, slot: 0 }, { label: "Other", value: 5 }]);
    expect(d.parts.map((p) => p.label)).toEqual(["A", "B", "Other"]);
    expect(d.parts[2]!.slot).toBeNull();
  });
  it("more than max parts: the smallest fold into Other", () => {
    const d = distribution([
      { label: "A", value: 48, slot: 0 }, { label: "B", value: 27, slot: 1 }, { label: "C", value: 15, slot: 2 },
      { label: "D", value: 6, slot: 3 }, { label: "E", value: 4, slot: 4 },
    ], 4);
    expect(d.parts.map((p) => [p.label, p.value, p.pct])).toEqual([["A", 48, 48], ["B", 27, 27], ["C", 15, 15], ["Other", 10, 10]]);
  });
  it("zero, negative and non-finite parts are dropped; empty total → no parts", () => {
    expect(distribution([{ label: "A", value: 0, slot: 0 }, { label: "B", value: Number.NaN, slot: 1 }, { label: "C", value: -2, slot: 2 }])).toEqual({ total: 0, parts: [] });
    expect(distribution([])).toEqual({ total: 0, parts: [] });
  });
  it("share label: whole percent, \"<1%\" for a visible part under 0.5%", () => {
    expect(shareLabel({ share: 0.48, pct: 48 })).toBe("48%");
    expect(shareLabel({ share: 0.004, pct: 0 })).toBe("<1%");
    expect(shareLabel({ share: 0.004, pct: 1 })).toBe("<1%");
    expect(shareLabel({ share: 0.006, pct: 1 })).toBe("1%");
  });
  it("missing slot falls back to input position", () => {
    const d = distribution([{ label: "x", value: 2 }, { label: "y", value: 2 }]);
    expect(d.parts.map((p) => p.slot)).toEqual([0, 1]);
  });
  it("splitUnit: digits major, prefix/suffix minor", () => {
    expect(splitUnit("2.02M")).toEqual({ lead: "", major: "2.02", minor: "M" });
    expect(splitUnit("Rp 4.2M")).toEqual({ lead: "Rp ", major: "4.2", minor: "M" });
    expect(splitUnit("1,284")).toEqual({ lead: "", major: "1,284", minor: "" });
    expect(splitUnit("52 %")).toEqual({ lead: "", major: "52", minor: " %" });
    expect(splitUnit("–")).toEqual({ lead: "", major: "–", minor: "" });
    expect(splitUnit("−3.5K")).toEqual({ lead: "", major: "−3.5", minor: "K" });
  });
});

describe("heatmap (spec §6.6)", () => {
  it("levels scale to the max, 0/null = empty (-1)", () => {
    const g = heatGrid([[0, 5, 10], [null, 2.5, 7.5]]);
    expect(g.max).toBe(10);
    expect(g.levels).toEqual([[-1, 4, 7], [-1, 2, 6]]);
  });
  it("pinned max: levels relative to the given scale end (CPU 0–100 %), values above it clamp to the top step", () => {
    const g = heatGrid([[0.5, 0.99, 1.4], [0.1, null, 0]], 8, 1);
    expect(g.max).toBe(1);
    expect(g.levels).toEqual([[4, 7, 7], [0, -1, -1]]);
  });
  it("a non-finite or non-positive pinned max falls back to the grid max", () => {
    expect(heatGrid([[5, 10]], 8, Number.NaN).max).toBe(10);
    expect(heatGrid([[5, 10]], 8, 0).max).toBe(10);
  });
  it("all empty → max 0, every cell empty", () => {
    expect(heatGrid([[0, null]])).toEqual({ max: 0, levels: [[-1, -1]] });
  });
  it("column ticks every 3 hours", () => {
    expect(hourTickLabels(24)).toEqual(["00", "", "", "03", "", "", "06", "", "", "09", "", "", "12", "", "", "15", "", "", "18", "", "", "21", "", ""]);
  });
});

describe("annotations (spec §6.8)", () => {
  const e = (t: number) => ({ t, label: `e${t}` });
  it("max 3 visible (the latest), the rest collapse", () => {
    const a = annotationLayout([e(5), e(1), e(3), e(4), e(2)], [0, 10]);
    expect(a.visible.map((x) => x.t)).toEqual([3, 4, 5]);
    expect(a.hidden.map((x) => x.t)).toEqual([1, 2]);
  });
  it("events outside the domain or invalid are ignored", () => {
    const a = annotationLayout([e(-1), e(11), { t: Number.NaN, label: "x" }, e(2)], [0, 10]);
    expect(a.visible.map((x) => x.t)).toEqual([2]);
    expect(a.hidden).toEqual([]);
  });
});

describe("table-view notes for annotations and thresholds", () => {
  const t = Date.UTC(2026, 9, 14, 7, 0) / 1000;
  it("every in-domain event is listed, hidden ones included", () => {
    const evs = [1, 2, 3, 4].map((k) => ({ t: t + k * 3600, label: `e${k}` }));
    expect(annotationRows(evs, [t, t + 86_400])).toEqual([
      "Event · e1 · 14 Oct · 15:00 WIB", "Event · e2 · 14 Oct · 16:00 WIB", "Event · e3 · 14 Oct · 17:00 WIB", "Event · e4 · 14 Oct · 18:00 WIB",
    ]);
    expect(annotationRows([{ t: t - 10, label: "x" }], [t, t + 60])).toEqual([]);
  });
  it("thresholds name their tone and formatted value", () => {
    expect(thresholdRows([{ value: 80, label: "Warning 80%", tone: "degraded" }], (v) => `${v}%`)).toEqual(["Threshold · Warning 80% (Degraded) · 80%"]);
  });
});

describe("tooltipPeriod", () => {
  const t = Date.UTC(2026, 9, 14, 7, 0) / 1000; // 14:00 WIB
  it("hourly buckets: date · time WIB", () => {
    expect(tooltipPeriod(t, 3600)).toBe("14 Oct · 14:00 WIB");
  });
  it("daily buckets: date and year", () => {
    expect(tooltipPeriod(t, 86_400)).toBe("14 Oct 2026");
  });
});
