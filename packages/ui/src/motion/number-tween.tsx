"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionLayer } from "./layer";
import { usePrefersReducedMotion } from "./reduced-motion";
import { EASE, tweenDuration } from "./tokens";
import { bezier, runTween } from "./tween";

const easeOut = bezier(...EASE.out);

/**
 * KPI value tween (spec §7.4): on a value change, counts from the previous value over
 * min(0.6, 0.3 + |Δ|/total · 0.3) s with ease-out; reduced motion swaps instantly. The first render shows `value`
 * (identical server and client HTML) unless `from` is given (e.g. 0 on app open). Every frame goes through `format`
 * so separators and units stay correct. Screen readers get only the final value (the animated text is aria-hidden).
 * With the deferred Framer layer loaded the change plays as a critically damped spring of the same length;
 * before that (or if its chunk is blocked) the rAF loop (`runTween`) runs. Either is cancelled on unmount and on
 * every new value.
 */
export function NumberTween({ value, format, from, total, className }: {
  value: number; format: (v: number) => string; from?: number; total?: number; className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const kit = useMotionLayer();
  const [shown, setShown] = useState(from ?? value);
  const current = useRef(from ?? value);

  useEffect(() => {
    const from = current.current;
    const seconds = tweenDuration(from, value, total, reduced);
    const onFrame = (v: number) => { current.current = v; setShown(v); };
    if (kit && seconds > 0) return kit.tween({ from, to: value, seconds, onUpdate: onFrame });
    return runTween({ from, to: value, seconds, ease: easeOut, onFrame });
    // `kit` arriving mid-tween must not restart it: only a new value (or setting) starts a tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, total, reduced]);

  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
