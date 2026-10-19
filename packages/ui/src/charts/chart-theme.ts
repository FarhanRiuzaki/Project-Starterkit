/** Single source of chart style (spec §6). Colours are token CSS variables; no hex in components. */
import { FOLD_LABEL, MAX_SERIES } from "../lib/series";

/** Categorical palette, fixed order (spec §3.3, CVD-validated). Index = slot − 1. */
const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"] as const;
/** The folded remainder ("Other") is neutral, never a palette hue (spec §3.3). */
export const OTHER_COLOR = "var(--fg-3)";
/** A failure-count series (failures next to successes) wears the Down mark instead of a palette slot. */
export const DOWN_COLOR = "var(--down-mark)";
export type SeriesTone = "down";
export const GRID = "var(--grid)";
export const BASELINE = "var(--line-strong)";
export const CARD = "var(--card)";
export const CROSSHAIR = "var(--line-strong)";
export const AXIS_TICK = { fontSize: 11, fill: "var(--fg-3)", fontVariantNumeric: "tabular-nums" } as const;
/** sm 160 / md 240 / lg 320 (spec §6); v2 names kept. */
export const CHART_HEIGHT = { compact: 160, standard: 240, detail: 320, sm: 160, md: 240, lg: 320 } as const;
export const LINE_WIDTH = 2;
export const DASH = "4 4";
/** Plot frame (spec §6.1): top 8, right 8; the x tick row (24) is the XAxis height; left = y tick width + 8. */
export const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const X_AXIS_HEIGHT = 24;
export const TICK_GAP = 8;

/** Colour of a 0-based slot (wraps after six). */
export const colorAt = (i: number) => SERIES_COLORS[((i % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length]!;
/** Colour by entity: "Other" is neutral, otherwise the fixed slot (0-based). */
export const seriesColor = (label: string, slot: number) => (label === FOLD_LABEL ? OTHER_COLOR : colorAt(slot));
/** Secondary / partial series: same hue at 35 % on the card (spec §6.3), stripes drawn on top. */
export const softColor = (color: string) => `color-mix(in srgb, ${color} 35%, var(--card))`;

/**
 * Legend keys for the Panel header (spec §6.1: legend right in the header, chart with `hideLegend`), with the colours
 * and the fold the chart itself uses: slot (else position) → `--chart-N`, more than six series → five + "Other".
 */
export function legendItems(series: readonly { label: string; slot?: number; striped?: boolean; dashed?: boolean; tone?: SeriesTone }[], max = MAX_SERIES) {
  const kept: readonly { label: string; slot?: number; striped?: boolean; dashed?: boolean; tone?: SeriesTone }[] = series.length <= max ? series : [...series.slice(0, max - 1), { label: FOLD_LABEL }];
  return kept.map((x, i) => ({ label: x.label, color: x.tone === "down" ? DOWN_COLOR : seriesColor(x.label, x.slot ?? i), striped: !!x.striped, dashed: !!x.dashed }));
}
