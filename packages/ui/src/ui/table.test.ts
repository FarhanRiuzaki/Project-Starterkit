// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Table } from "./table";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const proto = HTMLElement.prototype;
function sizes(scroll: number, client: number) {
  Object.defineProperty(proto, "scrollWidth", { configurable: true, get: () => scroll });
  Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => client });
}
afterEach(() => {
  delete (proto as { scrollWidth?: number }).scrollWidth;
  delete (proto as { clientWidth?: number }).clientWidth;
  document.body.innerHTML = "";
});

async function container() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(h(Table, { "aria-label": "Recent activity" }, h("tbody", null))));
  const el = host.querySelector<HTMLElement>('[data-slot="table-container"]')!;
  const out = { tabIndex: el.getAttribute("tabindex"), role: el.getAttribute("role"), label: el.getAttribute("aria-label"),
    scrolls: el.dataset.scrolls ?? null, overflow: el.className.includes("overflow-x-visible") ? "visible" : "auto" };
  await act(async () => root.unmount());
  return out;
}

describe("Table container (scrolls sideways inside its card on a narrow screen)", () => {
  it("wider than its box: a named, focusable region, so a keyboard can scroll it (axe scrollable-region-focusable)", async () => {
    sizes(600, 358);
    expect(await container()).toEqual({ tabIndex: "0", role: "region", label: "Recent activity", scrolls: "true", overflow: "auto" });
  });
  it("fits: no extra tab stop, and no scroll container (overflow visible), so a sticky header sticks to the window", async () => {
    sizes(358, 358);
    expect(await container()).toEqual({ tabIndex: null, role: null, label: null, scrolls: null, overflow: "visible" });
  });
});
