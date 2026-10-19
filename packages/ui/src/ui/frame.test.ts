import { describe, expect, it, vi } from "vitest";
import { frameScheduler } from "./frame";

/** A fake window: frames run when `flush()` is called, like the browser's next rendering step. */
function fakeWin() {
  let next = 1;
  const queue = new Map<number, () => void>();
  return {
    requestAnimationFrame: vi.fn((cb: () => void) => { const id = next++; queue.set(id, cb); return id; }),
    cancelAnimationFrame: vi.fn((id: number) => { queue.delete(id); }),
    flush() { const cbs = [...queue.values()]; queue.clear(); for (const cb of cbs) cb(); },
  };
}

describe("frameScheduler (layout reads off the commit path)", () => {
  it("runs the read in the next frame, not synchronously", () => {
    const win = fakeWin(), read = vi.fn();
    frameScheduler(read, win).schedule();
    expect(read).not.toHaveBeenCalled();
    win.flush();
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("coalesces many requests in one frame into one read (a burst of attribute mutations)", () => {
    const win = fakeWin(), read = vi.fn();
    const f = frameScheduler(read, win);
    f.schedule(); f.schedule(); f.schedule();
    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(1);
    win.flush();
    expect(read).toHaveBeenCalledTimes(1);
    f.schedule(); win.flush();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("cancel drops a pending read (unmount)", () => {
    const win = fakeWin(), read = vi.fn();
    const f = frameScheduler(read, win);
    f.schedule(); f.cancel(); win.flush();
    expect(read).not.toHaveBeenCalled();
  });
  it("without requestAnimationFrame (server, tests) it reads at once", () => {
    const read = vi.fn();
    frameScheduler(read, undefined).schedule();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
