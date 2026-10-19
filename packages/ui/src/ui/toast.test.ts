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
});
