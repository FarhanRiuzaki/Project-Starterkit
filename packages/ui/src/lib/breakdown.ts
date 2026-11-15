// Rows of a BreakdownCard (charts/breakdown-card.tsx): one total split into ranked parts. Pure, no DOM.
import { distribution, shareLabel } from "./chart-layout";
import { MAX_SERIES } from "./series";

/**
 * `id` = stable key when two parts can share a label (default: the label). `slot` = fixed 0-based colour slot of the
 * entity, kept as given. Without it a part takes the slot of its input position, so the first six keep their colour at
 * any rank; one that meets a slot already taken among the named rows (a part past the sixth, or one a given `slot`
 * claims) takes the lowest free slot, which can change when the named rows do: pass `slot` to pin it.
 */
export type BreakdownPart = { id?: string; label: string; value: number; slot?: number };
export type BreakdownRow = { id: string; label: string; value: number; slot: number | null; share: number; shareText: string };

/** Key of the folded row. */
export const OTHER_ID = "__other";

/** Rows shown, the folded one included: 2…6, since there are six colour slots (spec §3.3); not a number → the default 5. */
export const rowLimit = (max: number) => (Number.isNaN(max) ? 5 : Math.min(MAX_SERIES, Math.max(2, Math.floor(max))));

/**
 * Largest first (equal values keep the caller's order). A part-of-whole has no zero, negative or non-finite part:
 * those are left out of the rows and of the total. More parts than `max` → the `max − 1` largest, then one row
 * labelled `otherLabel` with the sum of the rest (slot null = neutral colour), always last. Shares follow
 * `distribution`: whole percentages that sum to 100, "<1%" for a visible part under 0.5 %.
 * `ids` = every counted part, largest first, the folded ones included.
 */
export function breakdown(parts: readonly BreakdownPart[], otherLabel: string, max = 5): { total: number; ids: string[]; rows: BreakdownRow[] } {
  const limit = rowLimit(max);
  const ranked = parts.map((p, at) => ({ id: p.id ?? p.label, label: p.label, value: p.value, slot: p.slot, at }))
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => b.value - a.value);
  const head = ranked.length > limit ? ranked.slice(0, limit - 1) : ranked;
  const rest = ranked.slice(head.length);
  // Colours of the named rows: given slots first, then input order, so where two meet the later part moves.
  const taken = new Set(head.flatMap((p) => (p.slot == null ? [] : [p.slot % MAX_SERIES])));
  for (const p of [...head].sort((a, b) => a.at - b.at)) {
    if (p.slot != null) continue;
    const own = p.at % MAX_SERIES;
    p.slot = taken.has(own) ? Array.from({ length: MAX_SERIES }, (_, i) => i).find((i) => !taken.has(i)) ?? own : own;
    taken.add(p.slot);
  }
  const kept: { id: string; label: string; value: number; slot: number | null }[] = head.map((p) => ({ id: p.id, label: p.label, value: p.value, slot: p.slot! }));
  if (rest.length) kept.push({ id: OTHER_ID, label: otherLabel, value: rest.reduce((a, p) => a + p.value, 0), slot: null });
  // The share rounding lives in distribution(); slot = position keeps this order, the empty label keeps it from folding.
  const d = distribution(kept.map((p, i) => ({ label: "", value: p.value, slot: i })), kept.length);
  return { total: d.total, ids: ranked.map((p) => p.id), rows: kept.map((p, i) => ({ ...p, share: d.parts[i]!.share, shareText: shareLabel(d.parts[i]!) })) };
}
