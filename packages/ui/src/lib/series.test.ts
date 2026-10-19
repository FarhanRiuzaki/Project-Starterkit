import { describe, expect, it } from "vitest";
import { ellipsize, foldBarSeries, foldSeries, MAX_SERIES, seqStep, sparkPath, stackTopKey, timeAxis, timeTickKind, timeTicks } from "./series";

describe("foldSeries", () => {
  const s = (label: string, v: number) => ({ label, points: [[0, v], [60, v * 2]] as [number, number][] });
  it("≤ 6 series (six palette slots, spec §3.3) are kept", () => {
    expect(foldSeries([s("a", 1), s("b", 2)]).map((x) => x.label)).toEqual(["a", "b"]);
    expect(MAX_SERIES).toBe(6);
  });
  it("the 7th series onwards are summed into Other", () => {
    const out = foldSeries([s("a", 1), s("b", 2), s("c", 3), s("d", 4), s("e", 5), s("f", 6), s("g", 7)]);
    expect(out.map((x) => x.label)).toEqual(["a", "b", "c", "d", "e", "Other"]);
    expect(out[5]!.points).toEqual([[0, 13], [60, 26]]);
    expect(foldSeries([s("a", 1), s("b", 2), s("c", 3), s("d", 4), s("e", 5)], 4).map((x) => x.label)).toEqual(["a", "b", "c", "Other"]);
  });
  it("titik tidak valid dibuang", () => {
    expect(foldSeries([{ label: "a", points: [[0, Number.NaN], [60, 2]] }])[0]!.points).toEqual([[60, 2]]);
  });
});

describe("sparkPath", () => {
  it("kosong → tanpa garis", () => {
    expect(sparkPath([], 100, 28)).toEqual({ line: "", area: "", last: null });
    expect(sparkPath([null, Number.NaN], 100, 28).line).toBe("");
  });
  it("nilai konstan → garis datar di tengah", () => {
    const p = sparkPath([5, 5, 5], 100, 28);
    expect(p.line).toBe("M0,14L50,14L100,14");
    expect(p.last).toEqual([100, 14]);
  });
  it("min di bawah, max di atas dengan padding", () => {
    expect(sparkPath([0, 10], 100, 28, 3).line).toBe("M0,25L100,3");
  });
});

describe("helper lain", () => {
  it("label sumbu waktu", () => {
    expect(timeTickKind(0, 86_400)).toBe("time");
    expect(timeTickKind(0, 3 * 86_400)).toBe("date");
  });
  it("segmen teratas bertumpuk yang tidak nol", () => {
    expect(stackTopKey({ a: 5, b: 0 }, ["a", "b"])).toBe("a");
    expect(stackTopKey({ a: 5, b: 2 }, ["a", "b"])).toBe("b");
    expect(stackTopKey({ a: 0, b: null }, ["a", "b"])).toBeNull();
  });
  it("langkah sekuensial", () => {
    expect(seqStep(0)).toBe(0);
    expect(seqStep(0.5)).toBe(4);
    expect(seqStep(1)).toBe(7);
    expect(seqStep(1.4)).toBe(7);
    expect(seqStep(null)).toBe(-1);
  });
});

describe("foldBarSeries", () => {
  const b = (label: string, values: (number | null)[]) => ({ label, values });
  it("NaN/Infinity/negatif menjadi null", () => {
    expect(foldBarSeries([b("a", [Number.NaN, Infinity, -1, 2])])[0]!.values).toEqual([null, null, null, 2]);
  });
  it("5 series → 3 + Other with summed values", () => {
    const out = foldBarSeries([b("a", [1, 1]), b("b", [2, 2]), b("c", [3, 3]), b("d", [4, null]), b("e", [5, null])], 4);
    expect(out.map((x) => x.label)).toEqual(["a", "b", "c", "Other"]);
    expect(out[3]!.values).toEqual([9, null]);
  });
  it("null + angka = angka; semua null tetap null", () => {
    const out = foldBarSeries([b("a", [1]), b("b", [1]), b("c", [1]), b("d", [null]), b("e", [2])], 4);
    expect(out[3]!.values).toEqual([2]);
    const out2 = foldBarSeries([b("a", [1]), b("b", [1]), b("c", [1]), b("d", [null]), b("e", [null])], 4);
    expect(out2[3]!.values).toEqual([null]);
  });
});

describe("ellipsize", () => {
  it("memotong dengan elipsis", () => {
    expect(ellipsize("abcdef", 6)).toBe("abcdef");
    expect(ellipsize("abcdefg", 6)).toBe("abcde…");
  });
});

describe("sparkPath celah", () => {
  it("null memulai segmen M baru", () => {
    const p = sparkPath([1, null, 3], 100, 28);
    expect(p.line.match(/M/g)).toHaveLength(2);
    expect(p.area.match(/Z/g)).toHaveLength(2);
  });
});

describe("timeTicks (tick waktu bulat WIB)", () => {
  const OFF = 7 * 3600;
  const wib = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo, d, h, mi) / 1000 - OFF;
  const isRound = (t: number, step: number) => (t + OFF) % step === 0;
  it("24 jam → kelipatan 6 jam WIB, 3–5 tick", () => {
    const t = timeTicks(wib(2026, 9, 15, 12, 7), wib(2026, 9, 16, 12, 7));
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(t.length).toBeLessThanOrEqual(5);
    expect(t.every((x) => isRound(x, 6 * 3600))).toBe(true);
    expect(t).toEqual([wib(2026, 9, 15, 18), wib(2026, 9, 16, 0), wib(2026, 9, 16, 6), wib(2026, 9, 16, 12)]);
  });
  it("1 jam → kelipatan 15 menit", () => {
    const t = timeTicks(wib(2026, 9, 16, 13, 4), wib(2026, 9, 16, 14, 4));
    expect(t).toEqual([wib(2026, 9, 16, 13, 15), wib(2026, 9, 16, 13, 30), wib(2026, 9, 16, 13, 45), wib(2026, 9, 16, 14)]);
  });
  it("7 hari → tengah malam WIB", () => {
    const t = timeTicks(wib(2026, 9, 9, 12), wib(2026, 9, 16, 12));
    expect(t.length).toBeLessThanOrEqual(5);
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(t.every((x) => isRound(x, 86_400))).toBe(true);
  });
  it("30 hari → ≤ 5 tick di tengah malam WIB", () => {
    const t = timeTicks(wib(2026, 8, 16, 12), wib(2026, 9, 16, 12));
    expect(t.length).toBeLessThanOrEqual(5);
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(t.every((x) => isRound(x, 86_400))).toBe(true);
  });
  it("target dihormati dan tick dalam rentang", () => {
    const a = wib(2026, 9, 15, 12, 7), b = wib(2026, 9, 16, 12, 7);
    const t = timeTicks(a, b, 3);
    expect(t.length).toBeLessThanOrEqual(3);
    expect(t.every((x) => x >= a && x <= b)).toBe(true);
  });
  it("rentang tidak valid → kosong", () => {
    expect(timeTicks(10, 10)).toEqual([]);
    expect(timeTicks(20, 10)).toEqual([]);
    expect(timeTicks(Number.NaN, 10)).toEqual([]);
    expect(timeTicks(0, Number.POSITIVE_INFINITY)).toEqual([]);
  });
  it("2,2 hari → langkah 12 jam (label jam, bukan tanggal berulang)", () => {
    const a = timeAxis(wib(2026, 9, 14, 7), wib(2026, 9, 16, 12));
    expect(a.step).toBe(43_200);
    expect(a.ticks.length).toBeGreaterThanOrEqual(3);
    expect(a.ticks.length).toBeLessThanOrEqual(5);
  });
  it("langkah 7 hari dan 30 hari", () => {
    expect(timeAxis(wib(2026, 9, 9, 12), wib(2026, 9, 16, 12)).step).toBe(172_800);
    expect(timeAxis(wib(2026, 8, 16, 12), wib(2026, 9, 16, 12)).step).toBe(604_800);
  });
  it("rentang sangat pendek → ≥ 3 tick rata", () => {
    const a = timeAxis(1000, 1090);
    expect(a.ticks).toEqual([1000, 1045, 1090]);
    expect(a.step).toBe(45);
  });
  it("rentang sangat panjang → tick menyebar di seluruh rentang", () => {
    const first = wib(2024, 0, 1), last = wib(2026, 0, 1);
    const a = timeAxis(first, last);
    expect(a.ticks.length).toBeGreaterThanOrEqual(3);
    expect(a.ticks.length).toBeLessThanOrEqual(5);
    expect(a.ticks.at(-1)!).toBeGreaterThan(first + 0.7 * (last - first));
    expect(a.ticks.every((x) => x >= first && x <= last)).toBe(true);
  });
  it("langkah berikutnya terlalu jarang → langkah sebelumnya dijarangkan (≥ 3 tick)", () => {
    const a = timeAxis(wib(2026, 9, 4, 12), wib(2026, 9, 16, 12)); // 12 hari
    expect(a.ticks.length).toBeGreaterThanOrEqual(3);
    expect(a.ticks.length).toBeLessThanOrEqual(5);
    expect(a.ticks.every((x) => (x + OFF) % 86_400 === 0)).toBe(true);
  });
});
