type FrameWin = { requestAnimationFrame: (cb: () => void) => number; cancelAnimationFrame: (id: number) => void };

/**
 * Layout reads (offsetLeft, scrollWidth, …) deferred to the next animation frame and coalesced: one read per frame
 * however many times `schedule` is called. Read from a layout effect, they force a synchronous layout inside the
 * React commit (the long task of hydration or navigation); in the frame callback the browser lays out once anyway.
 * No requestAnimationFrame (server, node tests): the read runs at once.
 */
export function frameScheduler(read: () => void, win: FrameWin | undefined = typeof window === "undefined" ? undefined : window) {
  let id = 0;
  return {
    schedule() {
      if (!win) { read(); return; }
      if (id) return;
      id = win.requestAnimationFrame(() => { id = 0; read(); });
    },
    cancel() {
      if (id && win) win.cancelAnimationFrame(id);
      id = 0;
    },
  };
}
