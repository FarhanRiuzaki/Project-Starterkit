// Chart layout math (spec §6). Pure, no DOM: bar geometry, distribution shares, arcs, heatmap levels, annotations.
import { APP_TIME_ZONE_LABEL, APP_UTC_OFFSET_SEC, formatDateWIB, formatTimeWIB } from "./format";
import { FOLD_LABEL } from "./series";

const r2 = (n: number) => Math.round(n * 100) / 100;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const BAR_MIN = 6;
export const BAR_MAX = 32;

/** Value-end cap radius: min(6, width / 4) (spec §6.3). */
export function barRadius(width: number): number {
  return width > 0 ? Math.min(6, width / 4) : 0;
}

/**
 * Bar width clamped to 6..32 px, centred on the bar Recharts gave it. The 6 px minimum never exceeds `slot` (the room
 * the bar may take, ≤ its share of the 72 % band), so dense bars shrink instead of overlapping.
 */
export function barWidth(x: number, width: number, slot = width): { x: number; width: number } {
  const w = Math.min(BAR_MAX, Math.max(Math.min(BAR_MIN, Math.max(slot, width)), width));
  return { x: r2(x + (width - w) / 2), width: w };
}

/**
 * Vertical bar path with rounded value end (`rTop`) and baseline end (`rBottom`). The value end keeps priority when
 * the bar is short: rTop ≤ min(w/2, h), rBottom ≤ h − rTop. Empty when the bar has no area.
 */
export function barPath(x: number, y: number, w: number, h: number, rTop: number, rBottom: number): string {
  if (!(w > 0) || !(h > 0)) return "";
  const t = r2(Math.max(0, Math.min(rTop, w / 2, h)));
  const b = r2(Math.max(0, Math.min(rBottom, w / 2, h - t)));
  const X = r2(x), Y = r2(y), R = r2(x + w), B = r2(y + h);
  return `M${X},${r2(B - b)}V${r2(Y + t)}Q${X},${Y} ${r2(X + t)},${Y}H${r2(R - t)}Q${R},${Y} ${R},${r2(Y + t)}`
    + `V${r2(B - b)}Q${R},${B} ${r2(R - b)},${B}H${r2(X + b)}Q${X},${B} ${X},${r2(B - b)}Z`;
}

/** Index of the largest positive value (first on ties) — the only bar with a direct label. −1 when none. */
export function maxIndex(values: (number | null | undefined)[]): number {
  let best = -1, max = 0;
  values.forEach((v, i) => { if (finite(v) && v > max) { max = v; best = i; } });
  return best;
}

/** Hollow markers only on short series (spec §6.4). */
export function markersVisible(points: number): boolean {
  return points > 0 && points <= 14;
}

export type DistPart = { label: string; value: number; slot: number | null; share: number; pct: number };

/**
 * Distribution bar (spec §6.5): drops empty parts; more than `max` parts → the `max − 1` largest + "Other"; ordered by
 * colour slot with Other last (slot null). `pct` are whole percentages that sum to 100 (largest remainder).
 */
export function distribution(input: { label: string; value: number; slot?: number }[], max = 4): { total: number; parts: DistPart[] } {
  const clean = input.map((p, i) => ({ label: p.label, value: p.value, slot: p.label === FOLD_LABEL ? null : (p.slot ?? i) }))
    .filter((p) => finite(p.value) && p.value > 0);
  const total = clean.reduce((a, p) => a + p.value, 0);
  if (total <= 0) return { total: 0, parts: [] };
  let kept = clean;
  if (clean.length > max) {
    const ranked = [...clean].sort((a, b) => b.value - a.value);
    const head = ranked.filter((p) => p.slot != null).slice(0, max - 1);
    const rest = clean.filter((p) => !head.includes(p)).reduce((a, p) => a + p.value, 0);
    kept = [...head, { label: FOLD_LABEL, value: rest, slot: null }];
  }
  kept = [...kept].sort((a, b) => (a.slot ?? Infinity) - (b.slot ?? Infinity));
  const raw = kept.map((p) => (p.value / total) * 100);
  const pct = raw.map(Math.floor);
  let left = 100 - pct.reduce((a, v) => a + v, 0);
  const order = raw.map((v, i) => ({ i, rem: v - Math.floor(v) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; pct[i]!++; left--; }
  return { total, parts: kept.map((p, i) => ({ ...p, share: p.value / total, pct: pct[i]! })) };
}

/** Share pill text: whole percent; a visible part under 0.5 % reads "<1%" instead of "0%". */
export function shareLabel(p: { share: number; pct: number }): string {
  return p.share > 0 && p.share < 0.005 ? "<1%" : `${p.pct}%`;
}

/** "Rp 4.2M" → lead "Rp ", major "4.2", minor "M": the number is the major digits, prefix/suffix render in fg-3. */
export function splitUnit(text: string): { lead: string; major: string; minor: string } {
  const m = /^(\D*?)([−-]?\d[\d.,]*)(.*)$/u.exec(text);
  if (!m) return { lead: "", major: text, minor: "" };
  return { lead: m[1]!, major: m[2]!, minor: m[3]! };
}

/** Heatmap levels: 8 sequential steps relative to the grid max; 0 / null / invalid = empty (−1). */
export function heatGrid(values: (number | null)[][], steps = 8, pinnedMax?: number): { max: number; levels: number[][] } {
  // `pinnedMax` fixes the scale end (e.g. CPU 100 %), so the ramp means the same on every refresh.
  const max = finite(pinnedMax) && pinnedMax > 0 ? pinnedMax : Math.max(0, ...values.flat().filter(finite));
  const levels = values.map((row) => row.map((v) => (!finite(v) || v <= 0 || max <= 0 ? -1 : Math.min(steps - 1, Math.floor((v / max) * steps)))));
  return { max, levels };
}

/** Column ticks every 3 hours ("00", "03", …), blank in between. */
export function hourTickLabels(n = 24, every = 3): string[] {
  return Array.from({ length: n }, (_, h) => (h % every === 0 ? String(h).padStart(2, "0") : ""));
}

export type Annotation = { t: number; label: string };

/** At most `max` annotations visible (the latest); earlier ones collapse into a "+N" chip. Out-of-domain → ignored. */
export function annotationLayout(events: Annotation[], domain: [number, number], max = 3): { visible: Annotation[]; hidden: Annotation[] } {
  const inside = events.filter((e) => finite(e.t) && e.t >= domain[0] && e.t <= domain[1]).sort((a, b) => a.t - b.t);
  const cut = Math.max(0, inside.length - max);
  return { visible: inside.slice(cut), hidden: inside.slice(0, cut) };
}

/** Tooltip eyebrow (spec §6.7): "14 Oct · 14:00 WIB" for sub-day buckets, "14 Oct 2026" for daily ones. */
export function tooltipPeriod(tSec: number, stepSec: number): string {
  const ms = tSec * 1000;
  if (stepSec >= 86_400) return `${formatDateWIB(ms)} ${new Date(ms + APP_UTC_OFFSET_SEC * 1000).getUTCFullYear()}`;
  return `${formatDateWIB(ms)} · ${formatTimeWIB(ms)} ${APP_TIME_ZONE_LABEL}`;
}

/** Table-view notes: every in-domain event (including those collapsed into "+N"), in time order. */
export function annotationRows(events: Annotation[], domain: [number, number]): string[] {
  const { visible, hidden } = annotationLayout(events, domain);
  return [...hidden, ...visible].map((e) => `Event · ${e.label} · ${tooltipPeriod(e.t, 3600)}`);
}

const TONE_NAME = { degraded: "Degraded", down: "Down" } as const;

/** Table-view notes for threshold lines. */
export function thresholdRows(list: { value: number; label: string; tone: keyof typeof TONE_NAME }[], format: (v: number) => string): string[] {
  return list.map((t) => `Threshold · ${t.label} (${TONE_NAME[t.tone]}) · ${format(t.value)}`);
}
