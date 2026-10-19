import { LOCALE } from "./format";

const STEPS = [1, 2, 2.5, 5, 10];

/** Tick sumbu Y: mulai 0, 3–5 interval dengan langkah 1/2/2,5/5 × 10ⁿ, tick teratas ≥ max. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = (STEPS.find((s) => s * mag >= raw) ?? 10) * mag;
  const n = Math.ceil(max / step - 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => Number((i * step).toPrecision(12)));
}

const nf = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const UNITS: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];

/** Y tick label, abbreviated from 1,000 (spec §6.2: "1.2K", "4.2M"); fractions below 1 keep 2 decimals. */
export function tickLabel(v: number): string {
  if (!Number.isFinite(v)) return "–";
  if (Math.abs(v) < 1 && v !== 0) return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(v);
  const a = Math.abs(v), sign = v < 0 ? "−" : "";
  for (const [div, unit] of UNITS) if (a >= div) return `${sign}${nf.format(a / div)}${unit}`;
  return sign + nf.format(a);
}

/** Inter 11 px: tabular figures ≈ 6.6 px, unit letters (K/M/B) ≈ 7.6 px, "." and "," ≈ 3.5 px. */
const glyph = (c: string) => (c === "." || c === "," ? 3.5 : /\d/.test(c) ? 6.6 : 7.6);

/** YAxis width: widest tick label (caption, 11 px) + 8 px gap, deterministic so the plot never shifts on mount. */
export function yTickWidth(labels: string[], gap = 8): number {
  const w = Math.max(8, ...labels.map((l) => [...l].reduce((a, c) => a + glyph(c), 0)));
  return Math.ceil(w) + gap + 2; // +2: subpixel rounding, so the widest label is never clipped
}
