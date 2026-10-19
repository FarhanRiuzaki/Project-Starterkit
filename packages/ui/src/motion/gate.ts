/**
 * Pure gating logic of the deferred Framer Motion layer (no React, no framer import; tested in gate.test.ts).
 * - `whenIdle`: run once the main thread is idle after hydration (requestIdleCallback with a timeout; a timer where
 *   the browser has none), so the framer chunk never competes with first paint or hydration.
 * - `createLoader`: one shared dynamic import per page; a blocked or failed chunk resolves null (the CSS motion
 *   stays) and may be retried later.
 * - `armPageSwap`: the layout switches from the CSS page enter to AnimatePresence only on the first route change
 *   after the layer arrived, because that is when the page subtree is replaced anyway (no remount of an open page).
 * - `canAnimateReorder` / `flipOffset`: card reorder (FLIP) only for 2…60 items and never under reduced motion.
 */
type IdleWin = {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
  setTimeout: (cb: () => void, ms: number) => unknown;
  clearTimeout: (id: never) => void;
};

export function whenIdle(cb: () => void, { timeout = 2000, fallbackMs = 300, win = typeof window === "undefined" ? undefined : (window as unknown as IdleWin) }: {
  timeout?: number; fallbackMs?: number; win?: IdleWin;
} = {}): () => void {
  if (!win) return () => undefined;
  if (win.requestIdleCallback) {
    const id = win.requestIdleCallback(cb, { timeout });
    return () => win.cancelIdleCallback?.(id);
  }
  const t = win.setTimeout(cb, fallbackMs);
  return () => win.clearTimeout(t as never);
}

export function createLoader<T>(load: () => Promise<T>) {
  let value: T | null = null;
  let pending: Promise<T | null> | null = null;
  return {
    get: () => value,
    load(): Promise<T | null> {
      if (value) return Promise.resolve(value);
      pending ??= load().then((v) => (value = v), () => { pending = null; return null; });
      return pending;
    },
  };
}

export type PageSwapState = { loadedOn: string | null; armed: boolean };

export function armPageSwap(s: PageSwapState, loaded: boolean, pathname: string): PageSwapState {
  if (!loaded || s.armed) return s;
  if (s.loadedOn == null) return { loadedOn: pathname, armed: false };
  return pathname === s.loadedOn ? s : { ...s, armed: true };
}

/** Lists longer than this jump instead of animating a reorder (spec §7.7: no layout animation on long lists). */
export const REORDER_MAX = 60;

export function canAnimateReorder(count: number, reduced: boolean): boolean {
  return !reduced && count > 1 && count <= REORDER_MAX;
}

type Pt = { x: number; y: number };
export function flipOffset(prev: Pt | undefined, next: Pt): { dx: number; dy: number } | null {
  if (!prev) return null;
  const dx = prev.x - next.x, dy = prev.y - next.y;
  return Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 ? null : { dx, dy };
}

type Pos = { x: number; y: number };
type FlipItem = { offsetLeft: number; offsetTop: number; style: { transform: string } };

/**
 * One FLIP pass over the grid's items (after every commit): records each item's layout position and, when `play`,
 * starts a flip for items that moved. The returned cancel stops the flips AND clears the inline transform: a
 * stopped framer animation freezes `transform` mid-way, and the next pass measures `offsetLeft/Top` (transform
 * blind), sees no move and would leave the card displaced.
 */
export function reorderPass<T extends FlipItem>(
  items: readonly T[], last: WeakMap<object, Pos>, flip: (el: T, dx: number, dy: number) => () => void, play: boolean,
): () => void {
  const cancels: (() => void)[] = [];
  for (const item of items) {
    const next = { x: item.offsetLeft, y: item.offsetTop };
    const d = play ? flipOffset(last.get(item), next) : null;
    if (d) {
      const stop = flip(item, d.dx, d.dy);
      cancels.push(() => { stop(); item.style.transform = ""; });
    }
    last.set(item, next);
  }
  return () => { for (const c of cancels) c(); };
}
