/**
 * Motion tokens (spec §7.1) as JS constants in seconds, mirroring the CSS variables in styles/tokens.css
 * (--dur-*, --ease-*, --shift-enter, --stagger; tokens.test keeps them in sync), plus the pure stagger and tween
 * helpers the motion primitives use. No runtime import: safe for tests, server code and any layer.
 */
export const DUR = { instant: 0.1, fast: 0.15, pop: 0.18, enter: 0.22, page: 0.26, exit: 0.16, slow: 0.28, tween: 0.6, flash: 1.2, draw: 0.4 } as const;

/**
 * The duration token each overlay opens and closes with: the classes in ui/* are `duration-(--dur-<key>)` with these
 * keys (ui/overlay-motion.test.ts checks them), and the /ds Motion inventory prints them.
 */
export const OVERLAY_MOTION = {
  /** Dropdown menus and popovers. */
  menu: { open: "pop", close: "instant" },
  tooltip: { open: "instant", close: "instant" },
  dialog: { open: "slow", close: "exit" },
  scrim: { open: "enter", close: "exit" },
} as const satisfies Record<string, { open: keyof typeof DUR; close: keyof typeof DUR }>;

type Bezier = readonly [number, number, number, number];
export const EASE = {
  out: [0.22, 1, 0.36, 1] as Bezier,
  in: [0.4, 0, 1, 1] as Bezier,
  standard: [0.2, 0, 0, 1] as Bezier,
  /** Reduced-motion fades and loops. */
  linear: [0, 0, 1, 1] as Bezier,
} as const;
/** An EASE curve as CSS text, the way tokens.css writes it. */
export const cssEase = (b: Bezier): string => `cubic-bezier(${b.join(", ")})`;

/**
 * Spec §7.3 indicator spring (segment thumb, tab underline). Used only by the deferred Framer layer (framer.tsx:
 * `layoutId` + domMax, loaded after idle); before it arrives — or if its chunk is blocked — the indicators are the
 * CSS transform transition (`indicator-move`: translateX over --dur-slow with --ease-out).
 */
export const SPRING_INDICATOR = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;
/** The one general-purpose spring of the deferred layer (number tweens, badge settle): no overshoot. */
export const SPRING_SOFT = { type: "spring", stiffness: 380, damping: 36, mass: 1 } as const;
/** Number tween spring: lasts the tween's duration (given per call), never overshoots the real value. */
export const SPRING_TWEEN = { type: "spring", bounce: 0 } as const;
/** Card reorder (FLIP) glide of the deferred layer: a touch softer than the indicator, no overshoot. */
export const SPRING_FLIP = { type: "spring", stiffness: 420, damping: 42, mass: 0.9 } as const;
/** translateY distance for enters, px. */
export const SHIFT_ENTER = 6;
/** 35 ms per item; the first `max` items are staggered, the rest appear with the last staggered one. */
export const STAGGER = { step: 0.035, max: 8 } as const;

/** Chart bars grow one after another (spec §7.4): 12 ms per bar, at most 200 ms in total. */
export const CHART_STAGGER = { step: 0.012, max: 0.2 } as const;

/** Grow delay of bar `index`, seconds. */
export function barDelay(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.round(Math.min(CHART_STAGGER.max, Math.floor(index) * CHART_STAGGER.step) * 1000) / 1000;
}

export function staggerDelay(index: number, reduced = false): number {
  if (reduced || !Number.isFinite(index) || index <= 0) return 0;
  return Math.round(Math.min(Math.floor(index), STAGGER.max - 1) * STAGGER.step * 1000) / 1000;
}

/**
 * Number tween length (spec §7.4): min(0.6, 0.3 + |Δ| / total · 0.3) s. `total` = the scale the change is judged
 * against (default: the larger magnitude of the two values). 0 = swap instantly (no change, bad input, reduced).
 */
export function tweenDuration(from: number, to: number, total?: number, reduced = false): number {
  if (reduced || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return 0;
  const scale = total != null && Number.isFinite(total) && total > 0 ? total : Math.max(Math.abs(from), Math.abs(to));
  return Math.min(DUR.tween, 0.3 + (Math.abs(to - from) / scale) * 0.3);
}
