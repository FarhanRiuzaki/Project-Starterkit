// @vitest-environment happy-dom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterLayout } from "./filter-layout";
import { QueryInput } from "./query-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });
const defaults = { q: "", status: "" };
const fields = [{ key: "q", label: "Search" }, { key: "status", label: "Status" }] as const;
const button = (name: string) => [...document.querySelectorAll("button")].find(b => b.textContent === name)!;
async function render(initial = defaults, deferred = false) {
  const apply = vi.fn();
  let publish = (_values: typeof defaults) => {};
  function Demo() {
    const [values, setValues] = useState(initial);
    publish = setValues;
    return h(FilterLayout<typeof defaults>, {
      values, defaults, fields, onApply: next => { apply(next); if (!deferred) setValues(next); },
      filters: (draft, patch) => h(QueryInput, { value: draft.q, immediate: true, onChange: q => patch({ q }), keys: [], label: "Search", placeholder: "Search" }),
      children: ({ trigger, summary }) => h("div", null, trigger, summary, h("p", null, "Results")),
    });
  }
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(h(Demo)));
  return { apply, publish: (values: typeof defaults) => act(async () => publish(values)) };
}
async function type(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
describe("FilterLayout", () => {
  it("keeps drafts out of the active count; immediate Apply includes the latest keystroke and Close preserves it", async () => {
    const { apply } = await render();
    await act(async () => button("Filters").click());
    await type("Alex");
    expect(apply).not.toHaveBeenCalled();
    expect(document.querySelector('[data-slot="filter-active-summary"]')).toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Close filters"]')!.click());
    await act(async () => button("Filters").click());
    expect(document.querySelector<HTMLInputElement>("input")!.value).toBe("Alex");
    await act(async () => document.querySelector<HTMLFormElement>('[data-slot="floating-filters"] form')!.requestSubmit());
    expect(apply).toHaveBeenLastCalledWith({ q: "Alex", status: "" });
    expect(document.querySelector('[aria-label="Filters, 1 active"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="filter-active-summary"]')!.textContent).toContain("Search: Alex");
  });
  it("marks URL-provided filters immediately; removing one preserves the others, and Clear filters clears all", async () => {
    const { apply } = await render({ q: "Alex", status: "active" });
    expect(document.querySelector('[aria-label="Filters, 2 active"]')).not.toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Remove filter Search: Alex"]')!.click());
    expect(apply).toHaveBeenLastCalledWith({ q: "", status: "active" });
    await act(async () => button("Clear filters").click());
    expect(apply).toHaveBeenLastCalledWith(defaults);
    expect(document.querySelector('[data-slot="filter-active-summary"]')).toBeNull();
  });
  it("a late acknowledgement of Apply keeps newer edits, while an external value change replaces them", async () => {
    const { publish } = await render(defaults, true);
    await act(async () => button("Filters").click());
    await type("Alex");
    await act(async () => document.querySelector<HTMLFormElement>('[data-slot="floating-filters"] form')!.requestSubmit());
    await type("Next draft");
    await publish({ q: "Alex", status: "" });
    expect(document.querySelector<HTMLInputElement>("input")!.value).toBe("Next draft");
    await publish(defaults);
    expect(document.querySelector<HTMLInputElement>("input")!.value).toBe("");
  });
});
