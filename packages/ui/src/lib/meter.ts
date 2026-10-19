export type MeterTone = "normal" | "warn" | "crit";

export function clampRatio(r: number | null | undefined): number {
  return r == null || !Number.isFinite(r) ? 0 : Math.min(1, Math.max(0, r));
}

export function meterTone(r: number | null | undefined): MeterTone {
  const v = r == null || !Number.isFinite(r) ? 0 : r;
  return v >= 0.9 ? "crit" : v >= 0.8 ? "warn" : "normal";
}

/**
 * Tick meter (spec §5.10): `count` ticks (24–40, default 32), `filled` = round(ratio × count), `threshold` = index
 * of the tick that reaches the threshold ratio (drawn taller), or null.
 */
export function tickState(ratio: number | null | undefined, count = 32, threshold?: number | null): { count: number; filled: number; threshold: number | null } {
  const n = Number.isFinite(count) ? Math.min(40, Math.max(24, Math.round(count))) : 32;
  const filled = Math.round(clampRatio(ratio) * n);
  const t = threshold == null || !Number.isFinite(threshold) ? null : Math.min(n - 1, Math.max(0, Math.ceil(clampRatio(threshold) * n) - 1));
  return { count: n, filled, threshold: t };
}
