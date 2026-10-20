import { describe, expect, it, vi } from "vitest";

const shown = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: Object.assign(shown, { success: shown, error: shown }) }));

import { toast, toasterMounted } from "./toast";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("toast", () => {
  it("waits for a mounted Toaster: sonner drops a toast published while no Toaster listens", async () => {
    toast("early");
    await tick();
    expect(shown).not.toHaveBeenCalled();
    toasterMounted(true);
    await tick();
    expect(shown).toHaveBeenCalledWith("early");
  });

  it("a Toaster that unmounts (a remount, React StrictMode) holds new toasts until it is back", async () => {
    shown.mockClear();
    toasterMounted(false);
    toast.error("while away");
    await tick();
    expect(shown).not.toHaveBeenCalled();
    toasterMounted(true);
    await tick();
    expect(shown).toHaveBeenCalledWith("while away");
  });

  it("undo: an Undo action that stays 8 s; the undo runs once per click", async () => {
    shown.mockClear();
    const onUndo = vi.fn();
    toast.undo("Deactivated Bima Rahma.", onUndo, { description: "Their sessions ended." });
    await tick();
    const [message, opts] = shown.mock.calls[0]! as [string, { description: string; duration: number; action: { label: string; onClick: () => void } }];
    expect(message).toBe("Deactivated Bima Rahma.");
    expect(opts.description).toBe("Their sessions ended.");
    expect(opts.duration).toBe(8000);
    expect(opts.action.label).toBe("Undo");
    opts.action.onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
