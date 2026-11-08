// @vitest-environment happy-dom
import { act, createElement as h, Fragment, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterLayout, FILTER_EXTERNAL_CHANGE } from "./filter-layout";
import { filterPanelLoader } from "./filter-panel";
import { QueryInput } from "./query-input";
import { selectionState } from "../lib/filter-selection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; vi.useRealTimers(); });
const defaults = { q: "", status: "" };
const fields = [{ key: "q", label: "Search" }, { key: "status", label: "Status", multiple: true }] as const;
const button = (name: string) => [...document.querySelectorAll("button")].find(b => b.textContent === name)!;
async function render(initial = defaults, deferred = false) {
  const apply = vi.fn();
  let publish = (_values: typeof defaults) => {};
  function Demo() {
    const [values, setValues] = useState(initial);
    publish = setValues;
    return h(FilterLayout<typeof defaults>, {
      values, defaults, fields, onApply: (next, options) => { apply(next, options); if (!deferred) setValues(next); },
      filters: (draft, patch) => h(Fragment, null,
        h(QueryInput, { value: draft.q, immediate: true, onChange: q => patch({ q }), keys: [], label: "Search", placeholder: "Search" }),
        h("button", { type: "button", onClick: () => patch({ status: selectionState(["active"]) }) }, "Select active")),
      children: ({ summary }) => h("div", null, summary, h("p", null, "Results")),
    });
  }
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(h(Demo)));
  return { apply, publish: (values: typeof defaults) => act(async () => publish(values)) };
}
async function openFilters() {
  await act(async () => { document.querySelector<HTMLButtonElement>('[data-slot="filter-panel-trigger"]')!.click(); await filterPanelLoader.load(); });
}
async function type(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
describe("live FilterLayout", () => {
  it("starts collapsed with an independent launcher and applied-option badges/chips", async () => {
    await render({ q: "Alex", status: selectionState(["active", "inactive"]) });
    const launcher = document.querySelector('[data-slot="filter-launcher"]')!;
    expect(launcher.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
    expect(launcher.querySelector("button")?.getAttribute("aria-label")).toBe("Expand filters, 3 active selections");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[data-slot="filter-results"]')?.textContent).toContain("Results");
  });
  it("debounces search, but a category change flushes the last keystroke and selection in one push without closing", async () => {
    const { apply } = await render();
    await openFilters();
    vi.useFakeTimers();
    await type("Alex");
    await act(async () => { vi.advanceTimersByTime(299); });
    expect(apply).not.toHaveBeenCalled();
    await act(async () => button("Select active").click());
    expect(apply).toHaveBeenCalledExactlyOnceWith({ q: "Alex", status: selectionState(["active"]) }, { history: "push" });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button("Apply filters")).toBeUndefined();
  });
  it("search replaces after 300 ms; Clear all cancels pending text and preserves group state", async () => {
    const { apply } = await render();
    await openFilters(); vi.useFakeTimers();
    await type("Alex");
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(apply).toHaveBeenLastCalledWith({ q: "Alex", status: "" }, { history: "replace" });
    await type("Never applied");
    await act(async () => button("Clear all").click());
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(apply).toHaveBeenLastCalledWith(defaults, { history: "push" });
    expect(document.querySelector<HTMLInputElement>("input")!.value).toBe("");
  });
  it("Back/view adoption cancels pending text; removing a chip keeps its sibling choice", async () => {
    const { apply, publish } = await render({ q: "", status: selectionState(["active", "inactive"]) });
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Remove filter Status: active"]')!.click());
    expect(apply).toHaveBeenLastCalledWith({ q: "", status: selectionState(["inactive"]) }, { history: "push" });
    await openFilters(); vi.useFakeTimers(); await type("Late text");
    await act(async () => window.dispatchEvent(new Event(FILTER_EXTERNAL_CHANGE)));
    await publish(defaults);
    const count = apply.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(apply).toHaveBeenCalledTimes(count);
    expect(document.querySelector<HTMLInputElement>("input")!.value).toBe("");
  });
  it("a Back URL is adopted before props acknowledgement and cancels uncommitted text", async () => {
    const { apply } = await render({ q: "Old", status: selectionState(["active"]) }, true);
    await openFilters(); vi.useFakeTimers(); await type("Uncommitted");
    await act(async () => {
      window.history.replaceState(null, "", "/?status=inactive");
      window.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(500);
    });
    expect(apply).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>("input")!.value).toBe("");
  });
});
