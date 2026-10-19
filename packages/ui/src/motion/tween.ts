/**
 * Frame loop behind NumberTween (spec §7.4), kept pure so it can be tested without a DOM: calls `onFrame` with the
 * eased value each frame and ends exactly on `to`. `seconds` 0 (reduced motion, no change) swaps synchronously.
 * Returns the cleanup that cancels the pending frame.
 */
export function runTween({ from, to, seconds, ease, onFrame, raf = requestAnimationFrame, caf = cancelAnimationFrame, now = () => performance.now() }: {
  from: number; to: number; seconds: number; ease: (p: number) => number; onFrame: (v: number) => void;
  raf?: (cb: (now: number) => void) => number; caf?: (id: number) => void; now?: () => number;
}): () => void {
  if (!(seconds > 0)) { onFrame(to); return () => undefined; }
  const t0 = now();
  let id = 0;
  let done = false;
  const step = (at: number) => {
    const p = Math.min(1, (at - t0) / (seconds * 1000));
    onFrame(p >= 1 ? to : from + (to - from) * ease(p));
    if (p < 1) id = raf(step); else done = true;
  };
  id = raf(step);
  return () => { if (!done) caf(id); };
}

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` as an easing function (Newton–Raphson on x, bisection fallback). Kept here
 * instead of importing motion's `cubicBezier`, so NumberTween (in every KPI tile) adds no motion code to a page.
 */
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (v: number) => {
    let t = v;
    for (let i = 0; i < 8; i++) {
      const err = x(t) - v;
      if (Math.abs(err) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1; t = v;
    for (let i = 0; i < 30; i++) { const xv = x(t); if (Math.abs(xv - v) < 1e-6) break; if (xv < v) lo = t; else hi = t; t = (lo + hi) / 2; }
    return t;
  };
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : y(solve(p)));
}
