import { describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

/** A minimal document for the execCommand fallback (Vitest runs in node: no DOM). */
function fakeDoc(execResult = true) {
  const appended: Array<{ value: string; removed: boolean }> = [];
  const doc = {
    activeElement: { focus: vi.fn() },
    body: {
      appendChild: (el: { value: string }) => { appended.push(el as never); return el; },
    },
    createElement: () => {
      const el = { value: "", style: {} as Record<string, string>, setAttribute: vi.fn(), select: vi.fn(), setSelectionRange: vi.fn(), removed: false, remove() { this.removed = true; } };
      return el;
    },
    execCommand: vi.fn(() => execResult),
    getSelection: () => null,
  };
  return { doc: doc as unknown as Document, appended, exec: doc.execCommand };
}

describe("copyText", () => {
  it("secure context with the Clipboard API: uses navigator.clipboard", async () => {
    const writeText = vi.fn(async () => {});
    const { doc, exec } = fakeDoc();
    expect(await copyText("ws-1", { doc, nav: { clipboard: { writeText } } as unknown as Navigator, secure: true })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("ws-1");
    expect(exec).not.toHaveBeenCalled();
  });

  it("plain http (no secure context, no navigator.clipboard): falls back to execCommand('copy') on a hidden textarea, then removes it", async () => {
    const { doc, appended, exec } = fakeDoc(true);
    expect(await copyText("ssh rina@10.190.7.99 -p 2222", { doc, nav: {} as Navigator, secure: false })).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(appended).toHaveLength(1);
    expect(appended[0]!.value).toBe("ssh rina@10.190.7.99 -p 2222");
    expect(appended[0]!.removed).toBe(true);
  });

  it("the Clipboard API rejects (permission): falls back to execCommand", async () => {
    const writeText = vi.fn(async () => { throw new Error("NotAllowedError"); });
    const { doc, exec } = fakeDoc(true);
    expect(await copyText("x", { doc, nav: { clipboard: { writeText } } as unknown as Navigator, secure: true })).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("both ways fail: false (the caller tells the user to copy by hand)", async () => {
    const { doc } = fakeDoc(false);
    expect(await copyText("x", { doc, nav: {} as Navigator, secure: false })).toBe(false);
  });
});
