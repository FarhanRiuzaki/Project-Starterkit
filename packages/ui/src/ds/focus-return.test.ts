import { describe, expect, it, vi } from "vitest";
import { focusBack, returnTarget } from "./focus-return";

type Fake = { tagName: string; isConnected: boolean; focus: ReturnType<typeof vi.fn>; attrs: Map<string, string>;
  hasAttribute: (k: string) => boolean; setAttribute: (k: string, v: string) => void };
const el = (tagName: string, isConnected = true): Fake => {
  const attrs = new Map<string, string>();
  return { tagName, isConnected, focus: vi.fn(), attrs, hasAttribute: (k) => attrs.has(k), setAttribute: (k, v) => void attrs.set(k, v) };
};
const doc = (h1: Fake | null) => {
  const body = el("BODY");
  return { body, querySelector: vi.fn(() => h1) } as unknown as Document & { body: Fake };
};

/** Dialogs mounted on click have no Radix trigger: focus goes back to the control that opened them (WCAG 2.4.3). */
describe("focusBack (dialog close without a Radix trigger)", () => {
  it("focuses the element that had focus when the dialog opened, while it is still on the page", () => {
    const origin = el("BUTTON"); const h1 = el("H1"); const d = doc(h1);
    focusBack(origin as unknown as HTMLElement, d);
    expect(origin.focus).toHaveBeenCalledOnce();
    expect(h1.focus).not.toHaveBeenCalled();
  });
  it("falls back to the page h1 (made focusable) when the origin is gone, was the body, or unknown", () => {
    for (const origin of [el("BUTTON", false), null]) {
      const h1 = el("H1"); focusBack(origin as unknown as HTMLElement | null, doc(h1));
      expect(h1.focus).toHaveBeenCalledOnce();
      expect(h1.attrs.get("tabindex")).toBe("-1");
    }
    const h1 = el("H1"); const d = doc(h1);
    focusBack(d.body as unknown as HTMLElement, d);
    expect(h1.focus).toHaveBeenCalledOnce();
  });
  it("keeps an h1's own tabindex", () => {
    const h1 = el("H1"); h1.setAttribute("tabindex", "0");
    focusBack(null, doc(h1));
    expect(h1.attrs.get("tabindex")).toBe("0");
  });
});

/** After a change the opener may vanish once the list reloads (I1): skip it and use the page's fallbacks, never the body. */
describe("returnTarget (fallbacks after a change)", () => {
  const page = (map: Record<string, Fake | null>) => {
    const body = el("BODY");
    return { body, querySelector: vi.fn((sel: string) => map[sel] ?? null) } as unknown as Document & { body: Fake };
  };
  const FALLBACKS = ["#allowlist-title", "#allowlist-add"];
  it("the opener while it is on the page and nothing changed", () => {
    const origin = el("BUTTON");
    expect(returnTarget(origin as unknown as HTMLElement, page({}), { fallbacks: FALLBACKS })).toBe(origin);
  });
  it("after a change: the first fallback on the page, even when the opener is still connected", () => {
    const origin = el("BUTTON"); const title = el("SPAN");
    expect(returnTarget(origin as unknown as HTMLElement, page({ "#allowlist-title": title }), { skipOrigin: true, fallbacks: FALLBACKS })).toBe(title);
  });
  it("skips a missing, detached or disabled fallback; ends at the page h1, never the body", () => {
    const add = Object.assign(el("BUTTON"), { disabled: true }); const gone = el("SPAN", false); const h1 = el("H1");
    const d = page({ "#allowlist-title": gone, "#allowlist-add": add, "main h1": h1 });
    expect(returnTarget(el("BUTTON", false) as unknown as HTMLElement, d, { fallbacks: FALLBACKS })).toBe(h1);
    expect(returnTarget(null, page({}), { fallbacks: FALLBACKS })).toBeNull();
  });
  it("focusBack makes a non-focusable fallback programmatically focusable", () => {
    const title = el("SPAN");
    focusBack(null, page({ "#allowlist-title": title }), { fallbacks: FALLBACKS });
    expect(title.focus).toHaveBeenCalledOnce();
    expect(title.attrs.get("tabindex")).toBe("-1");
    const add = el("BUTTON");
    focusBack(null, page({ "#allowlist-add": add }), { fallbacks: FALLBACKS });
    expect(add.attrs.has("tabindex")).toBe(false);
  });
});
