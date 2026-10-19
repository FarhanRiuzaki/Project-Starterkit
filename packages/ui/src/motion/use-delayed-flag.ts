"use client";

import { useEffect, useState } from "react";
import { LOADING } from "./tokens";

type Timing = { delay: number; minVisible: number; margin: number };

/**
 * Pure timing of a loading indicator (tested with fake timers): `set(true)` shows it after `delay` s; `set(false)`
 * hides it, but not before it has been on screen `minVisible + margin` s; loading again meanwhile keeps it shown.
 * "On screen" counts from `committed()` (the effect after React rendered it), not from the timer, so render time
 * can't shorten it. `onChange` gets each switch; `dispose` cancels a pending one. `now` is a monotonic clock in ms.
 */
export function delayedFlag(onChange: (shown: boolean) => void, { delay, minVisible, margin }: Timing, now: () => number = () => performance.now()) {
  let on = false;
  let shown = false;
  let since = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flip = (v: boolean) => { shown = v; since = now(); onChange(v); };
  return {
    set(next: boolean) {
      if (next === on) return;
      on = next;
      clearTimeout(timer);
      if (next && !shown) timer = setTimeout(() => flip(true), delay * 1000);
      if (!next && shown) {
        const left = since + (minVisible + margin) * 1000 - now();
        if (left > 0) timer = setTimeout(() => flip(false), left);
        else flip(false);
      }
    },
    /** The shown state has been committed to the screen: the minimum counts from now. */
    committed() { if (shown) since = now(); },
    dispose() { clearTimeout(timer); on = false; },
  };
}

/**
 * `on` as a loading indicator should show it: false for the first `delay` (150 ms) of loading, then true for at
 * least `minVisible` (300 ms) after it reached the screen. Gate every skeleton, busy dim and aria-busy on it, so fast
 * loads show nothing and slow ones never blink. Starts false on the server and on the first client render.
 */
export function useDelayedFlag(on: boolean, timing: Timing = LOADING): boolean {
  const [shown, setShown] = useState(false);
  const [flag] = useState(() => delayedFlag(setShown, timing));
  useEffect(() => { if (shown) flag.committed(); }, [flag, shown]);
  useEffect(() => flag.set(on), [flag, on]);
  useEffect(() => flag.dispose, [flag]);
  return shown;
}
