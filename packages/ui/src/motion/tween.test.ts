import { describe, expect, it } from "vitest";
import { bezier, runTween } from "./tween";

/** Manual frame clock: `tick(ms)` advances time and runs the queued frame. */
function clock() {
  let t = 0; let next: ((now: number) => void) | null = null; let cancelled = 0;
  return {
    raf: (cb: (now: number) => void) => { next = cb; return 1; },
    caf: () => { next = null; cancelled++; },
    now: () => t,
    tick(ms: number) { t += ms; const cb = next; next = null; cb?.(t); },
    get pending() { return next != null; }, get cancelled() { return cancelled; },
  };
}

describe("runTween (NumberTween engine)", () => {
  it("eases from → to over `seconds` and ends exactly on the target", () => {
    const c = clock(); const seen: number[] = [];
    runTween({ from: 0, to: 100, seconds: 0.5, ease: (p) => p, onFrame: (v) => seen.push(v), ...c });
    c.tick(250); expect(seen.at(-1)).toBeCloseTo(50);
    c.tick(250); expect(seen.at(-1)).toBe(100);
    expect(c.pending).toBe(false);
  });
  it("0 seconds (reduced motion / no change) swaps instantly, synchronously, with no frame scheduled", () => {
    const c = clock(); const seen: number[] = [];
    runTween({ from: 3, to: 9, seconds: 0, ease: (p) => p, onFrame: (v) => seen.push(v), ...c });
    expect(seen).toEqual([9]);
    expect(c.pending).toBe(false);
  });
  it("cancel stops further frames (unmount / value change cleanup)", () => {
    const c = clock(); const seen: number[] = [];
    const cancel = runTween({ from: 0, to: 10, seconds: 1, ease: (p) => p, onFrame: (v) => seen.push(v), ...c });
    c.tick(100);
    cancel();
    expect(c.cancelled).toBe(1);
    c.tick(900);
    expect(seen.length).toBe(1);
  });
});

describe("bezier (CSS cubic-bezier timing function)", () => {
  it("matches the curve's endpoints and is monotonic for --ease-out", () => {
    const e = bezier(0.22, 1, 0.36, 1);
    expect(e(0)).toBe(0);
    expect(e(1)).toBe(1);
    const xs = [0.1, 0.25, 0.5, 0.75, 0.9].map(e);
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    expect(e(0.5)).toBeGreaterThan(0.85); // ease-out: most of the change happens early
  });
  it("linear control points give the identity", () => {
    const l = bezier(0, 0, 1, 1);
    for (const x of [0.2, 0.5, 0.8]) expect(l(x)).toBeCloseTo(x, 4);
  });
});
