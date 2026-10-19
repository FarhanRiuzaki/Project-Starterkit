import { describe, expect, it, vi } from "vitest";
import { armPageSwap, canAnimateReorder, createLoader, flipOffset, REORDER_MAX, reorderPass, whenIdle } from "./gate";

describe("whenIdle (deferred layer load gate)", () => {
  it("uses requestIdleCallback with a timeout when the browser has it", () => {
    const ric = vi.fn((cb: () => void, _o?: { timeout: number }) => { cb(); return 7; });
    const cb = vi.fn();
    whenIdle(cb, { timeout: 1500, win: { requestIdleCallback: ric, cancelIdleCallback: vi.fn(), setTimeout, clearTimeout } });
    expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 1500 });
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it("falls back to a timer when requestIdleCallback is missing (Safari)", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    whenIdle(cb, { fallbackMs: 200, win: { setTimeout, clearTimeout } });
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it("the returned cancel stops a pending callback (unmount before idle)", () => {
    const cancelIdle = vi.fn();
    const cancel = whenIdle(vi.fn(), { win: { requestIdleCallback: () => 3, cancelIdleCallback: cancelIdle, setTimeout, clearTimeout } });
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(3);
    vi.useFakeTimers();
    const cb = vi.fn();
    const c2 = whenIdle(cb, { fallbackMs: 50, win: { setTimeout, clearTimeout } });
    c2();
    vi.advanceTimersByTime(100);
    expect(cb).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("no window (server) → no-op", () => {
    const cb = vi.fn();
    expect(() => whenIdle(cb, { win: undefined })()).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("createLoader (one framer chunk per page, failure-safe)", () => {
  it("concurrent loads share one import; get() is synchronous after it resolves", async () => {
    const imp = vi.fn(async () => ({ v: 1 }));
    const l = createLoader(imp);
    expect(l.get()).toBeNull();
    const [a, b] = await Promise.all([l.load(), l.load()]);
    expect(imp).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(l.get()).toEqual({ v: 1 });
  });
  it("a blocked or failed chunk resolves null (never throws) and can be retried later", async () => {
    let fail = true;
    const imp = vi.fn(async () => { if (fail) throw new Error("ChunkLoadError"); return { v: 2 }; });
    const l = createLoader(imp);
    await expect(l.load()).resolves.toBeNull();
    expect(l.get()).toBeNull();
    fail = false;
    await expect(l.load()).resolves.toEqual({ v: 2 });
    expect(imp).toHaveBeenCalledTimes(2);
  });
});

describe("armPageSwap (when the layout switches from the CSS enter to AnimatePresence)", () => {
  const s0 = { loadedOn: null, armed: false };
  it("stays CSS until the layer is loaded", () => {
    expect(armPageSwap(s0, false, "/")).toEqual(s0);
  });
  it("records the route the layer arrived on, and does not swap the tree there (no remount of the open page)", () => {
    expect(armPageSwap(s0, true, "/")).toEqual({ loadedOn: "/", armed: false });
  });
  it("arms on the next route change (the page subtree is replaced anyway) and stays armed", () => {
    const s1 = armPageSwap(s0, true, "/");
    const s2 = armPageSwap(s1, true, "/items");
    expect(s2).toEqual({ loadedOn: "/", armed: true });
    expect(armPageSwap(s2, true, "/")).toBe(s2);
  });
  it("returns the same object when nothing changes (safe to call while rendering)", () => {
    const s1 = armPageSwap(s0, true, "/");
    expect(armPageSwap(s1, true, "/")).toBe(s1);
    expect(armPageSwap(s0, false, "/x")).toBe(s0);
  });
});

describe("reorder (FLIP) gating", () => {
  it(`animates 2…${REORDER_MAX} items, skips larger lists and reduced motion`, () => {
    expect(REORDER_MAX).toBe(60);
    expect(canAnimateReorder(24, false)).toBe(true);
    expect(canAnimateReorder(60, false)).toBe(true);
    expect(canAnimateReorder(61, false)).toBe(false);
    expect(canAnimateReorder(500, false)).toBe(false);
    expect(canAnimateReorder(1, false)).toBe(false);
    expect(canAnimateReorder(24, true)).toBe(false);
  });
  it("flipOffset = previous − next position; sub-pixel moves are ignored", () => {
    expect(flipOffset({ x: 0, y: 300 }, { x: 320, y: 0 })).toEqual({ dx: -320, dy: 300 });
    expect(flipOffset({ x: 10, y: 10 }, { x: 10.3, y: 9.8 })).toBeNull();
    expect(flipOffset(undefined, { x: 1, y: 1 })).toBeNull();
  });
});

describe("reorderPass (FLIP pass; a re-render mid-reorder must not strand cards)", () => {
  type Item = { offsetLeft: number; offsetTop: number; style: { transform: string } };
  const card = (x: number, y: number): Item => ({ offsetLeft: x, offsetTop: y, style: { transform: "" } });
  /** Fake of framer's flip: writes a transform, and `stop()` freezes it where it is (the real behaviour). */
  const flip = (el: Item, dx: number, dy: number) => {
    el.style.transform = `translate(${dx / 2}px, ${dy / 2}px)`;
    return () => undefined;
  };

  it("cancelling a running flip clears the frozen transform, so a re-render leaves every card in place", () => {
    const a = card(0, 0), b = card(320, 0);
    const last = new WeakMap<object, { x: number; y: number }>();
    reorderPass([a, b], last, flip, true); // first commit: positions recorded, nothing to play
    a.offsetLeft = 320; b.offsetLeft = 0; // sort flips the two cards
    const cancel = reorderPass([a, b], last, flip, true);
    expect(a.style.transform).not.toBe("");
    cancel(); // React re-renders mid-spring: the effect cleanup runs
    const again = reorderPass([a, b], last, flip, true); // same layout: no new animation is started
    expect(a.style.transform).toBe("");
    expect(b.style.transform).toBe("");
    again();
  });
  it("plays nothing when animation is not allowed, but still records positions", () => {
    const a = card(0, 0);
    const last = new WeakMap<object, { x: number; y: number }>();
    reorderPass([a], last, flip, false);
    a.offsetLeft = 50;
    reorderPass([a], last, flip, false);
    expect(a.style.transform).toBe("");
    expect(last.get(a)).toEqual({ x: 50, y: 0 });
  });
});
