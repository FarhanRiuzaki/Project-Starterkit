// Motion primitives (spec §7). Base layer: CSS keyframes/transitions (page enter, stagger, reveal, indicators) and a
// rAF loop (NumberTween), so server HTML is visible without JS. On top, a deferred motion (motion.dev) layer
// (`MotionLayer`, framer.tsx) is imported after idle — never in first-load JS — and adds the page crossfade with
// exit, `layoutId` indicators with the spec spring, spring number tweens and card reorder. Only this folder may
// import `motion` / `motion/react` (architecture test), and only framer.tsx does so (layer.test.ts).
export { SharedIndicator } from "./indicator";
export { MotionLayer, type MotionKit, useMotionLayer } from "./layer";
export { NumberTween } from "./number-tween";
export { PageTransition, PageTransitionRoot } from "./page-transition";
export { Reveal } from "./reveal";
export { Stagger, StaggerItem } from "./stagger";
export { useChangeKey } from "./use-change-key";
export { useNewKeys } from "./use-new-keys";
export { DUR, EASE, SHIFT_ENTER, SPRING_INDICATOR, SPRING_SOFT, STAGGER, staggerDelay, tweenDuration } from "./tokens";
