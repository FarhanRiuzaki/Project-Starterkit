import { describe, expect, it } from "vitest";
import { scrubCopy } from "./frozen-copy";

/** Just enough of an element: tag, attributes, and `matches` by tag list. */
function el(tag: string, attrs: Record<string, string>) {
  const a = new Map(Object.entries(attrs));
  return { tag, a, removeAttribute: (n: string) => void a.delete(n), matches: (sel: string) => sel.split(",").map((s) => s.trim()).includes(tag) };
}

describe("frozen copy of the previous page", () => {
  it("keeps no id, no label/ARIA reference into the live page, and no input name", () => {
    const els = [
      el("div", { id: "content", class: "grid", "data-x": "1" }),
      el("label", { for: "pw-current", class: "text-label" }),
      el("input", { id: "pw-current", name: "current", "aria-describedby": "pw-note", "aria-labelledby": "h", type: "password" }),
      el("button", { "aria-controls": "menu-1", name: "go", "aria-label": "Open" }),
      el("select", { name: "role", "aria-errormessage": "e", list: "x" }),
    ];
    scrubCopy(els);
    expect(els.map((e) => Object.fromEntries(e.a))).toEqual([
      { class: "grid", "data-x": "1" },
      { class: "text-label" },
      { type: "password" },
      { "aria-label": "Open" },
      {},
    ]);
  });
});
