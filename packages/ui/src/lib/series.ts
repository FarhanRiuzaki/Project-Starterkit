import { mergeSeries, type Point } from "./chart-data";
import { APP_UTC_OFFSET_SEC } from "./format";

/** Label of the folded remainder series ("Other"), used by every fold. */
export const FOLD_LABEL = "Other";

/** Six categorical slots (spec §3.3); the 7th series onwards fold into "Other". */
export const MAX_SERIES = 6;
type Series = { label: string; points: Point[] };
const clean = (pts: Point[]) => pts.filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));

/** Limit the series count (spec §3.3): the rest are summed per timestamp into "Other". */
export function foldSeries(series: Series[], max = MAX_SERIES): Series[] {
  const s = series.map((x) => ({ label: x.label, points: clean(x.points) }));
  if (s.length <= max) return s;
  const keep = s.slice(0, max - 1);
  const rest = mergeSeries(s.slice(max - 1).map((x, i) => ({ key: `k${i}`, points: x.points })));
  const other: Point[] = rest.map((row) => [row.t, Object.entries(row).reduce((a, [k, v]) => (k === "t" ? a : a + (v as number)), 0)]);
  return [...keep, { label: FOLD_LABEL, points: other }];
}

/** Path sparkline (tanpa sumbu): skala min..max ke tinggi dengan padding; nilai konstan di tengah. Celah (null/NaN) memulai segmen "M" baru. */
export function sparkPath(values: (number | null)[], w: number, h: number, pad = 3) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null && Number.isFinite(p[1]));
  if (pts.length === 0) return { line: "", area: "", last: null as [number, number] | null };
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys), max = Math.max(...ys);
  const n = Math.max(1, values.length - 1);
  const segs: [number, number][][] = [];
  let prev = -2;
  for (const [i, v] of pts) {
    const x = Math.round((i / n) * w * 100) / 100;
    const y = max === min ? h / 2 : Math.round((h - pad - ((v - min) / (max - min)) * (h - 2 * pad)) * 100) / 100;
    if (i !== prev + 1) segs.push([]);
    segs[segs.length - 1]!.push([x, y]);
    prev = i;
  }
  const lines = segs.map((seg) => seg.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(""));
  const areas = segs.map((seg, k) => `${lines[k]}L${seg[seg.length - 1]![0]},${h}L${seg[0]![0]},${h}Z`);
  const lastSeg = segs[segs.length - 1]!;
  return { line: lines.join(""), area: areas.join(""), last: lastSeg[lastSeg.length - 1]! };
}

export function timeTickKind(firstSec: number, lastSec: number): "time" | "date" {
  return lastSec - firstSec > 2 * 86_400 ? "date" : "time";
}

/** Langkah tick waktu bulat (detik): menit → jam → 3/6/12 jam → hari → minggu. */
const TIME_STEPS = [60, 300, 600, 900, 1800, 3600, 7200, 10_800, 21_600, 43_200, 86_400, 172_800, 604_800, 1_209_600, 2_592_000];

export type TimeAxis = { ticks: number[]; step: number };

/**
 * Tick sumbu X di waktu bulat WIB (spec §8: 3–5 tick) beserta langkahnya — label memakai `step`
 * (≥ 1 hari → tanggal, selain itu jam). Langkah terkecil yang menghasilkan ≤ `target` tick; bila langkah
 * berikutnya terlalu jarang (< 3), langkah sebelumnya dijarangkan (tiap k tick). Langkah ≥ 1 hari sejajar
 * tengah malam WIB. Rentang sangat pendek → 3 tick rata (awal, tengah, akhir). Rentang tidak valid → kosong.
 */
export function timeAxis(firstSec: number, lastSec: number, target = 5): TimeAxis {
  if (!Number.isFinite(firstSec) || !Number.isFinite(lastSec) || lastSec <= firstSec) return { ticks: [], step: 0 };
  const max = Math.max(1, Math.floor(target));
  const min = Math.min(3, max);
  const ticksFor = (step: number) => {
    const out: number[] = [];
    for (let t = Math.ceil((firstSec + APP_UTC_OFFSET_SEC) / step) * step - APP_UTC_OFFSET_SEC; t <= lastSec; t += step) out.push(t);
    return out;
  };
  const thin = (a: TimeAxis): TimeAxis => {
    const k = Math.ceil(a.ticks.length / max);
    return { ticks: a.ticks.filter((_, i) => i % k === 0), step: a.step * k };
  };
  let prev: TimeAxis | null = null;
  for (const step of TIME_STEPS) {
    // Lewati langkah yang jelas terlalu rapat tanpa membuat larik besar.
    if ((lastSec - firstSec) / step > max * 4) { prev = null; continue; }
    const ticks = ticksFor(step);
    if (ticks.length > max) { prev = { ticks, step }; continue; }
    if (ticks.length >= min) return { ticks, step };
    if (prev) { const t = thin(prev); if (t.ticks.length >= min) return t; }
    if (step === TIME_STEPS[0]) {
      const half = (lastSec - firstSec) / 2;
      return { ticks: [firstSec, firstSec + half, lastSec], step: half };
    }
    return { ticks, step };
  }
  // Rentang sangat panjang: jarangkan langkah terbesar agar tick menyebar di seluruh rentang.
  return thin({ ticks: ticksFor(TIME_STEPS[TIME_STEPS.length - 1]!), step: TIME_STEPS[TIME_STEPS.length - 1]! });
}

/** Hanya posisi tick dari `timeAxis`. */
export function timeTicks(firstSec: number, lastSec: number, target = 5): number[] {
  return timeAxis(firstSec, lastSec, target).ticks;
}

/** Kunci segmen teratas yang bernilai > 0 — satu-satunya yang mendapat ujung membulat. */
export function stackTopKey(row: Record<string, number | null | undefined>, keys: string[]): string | null {
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = row[keys[i]!];
    if (v != null && v > 0) return keys[i]!;
  }
  return null;
}

/** Nilai 0..1 → indeks langkah sekuensial (8 langkah --chart-seq-1..8). */
export function seqStep(value: number | null | undefined, steps = 8): number {
  if (value == null || !Number.isFinite(value)) return -1;
  return Math.min(steps - 1, Math.max(0, Math.floor(value * steps)));
}

/** Bersihkan nilai bar (non-finit/negatif → null); seri ke-max dst. dijumlah per kategori menjadi "Other". */
export function foldBarSeries(series: { label: string; values: (number | null)[] }[], max = MAX_SERIES): { label: string; values: (number | null)[] }[] {
  const s = series.map((x) => ({ label: x.label, values: x.values.map((v) => (v != null && Number.isFinite(v) && v >= 0 ? v : null)) }));
  if (s.length <= max) return s;
  const keep = s.slice(0, max - 1);
  const rest = s.slice(max - 1);
  const len = Math.max(...rest.map((x) => x.values.length));
  const values = Array.from({ length: len }, (_, i) => {
    let sum: number | null = null;
    for (const x of rest) { const v = x.values[i]; if (v != null) sum = (sum ?? 0) + v; }
    return sum;
  });
  return [...keep, { label: FOLD_LABEL, values }];
}

export function ellipsize(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`;
}
