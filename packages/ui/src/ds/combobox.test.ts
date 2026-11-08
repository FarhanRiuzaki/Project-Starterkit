// @vitest-environment happy-dom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ComboOption, Combobox, filterOptions, nextEnabled } from "./combobox";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const OPTS: ComboOption[] = [
  { value: "jkt", label: "Jakarta" }, { value: "bdg", label: "Bandung" }, { value: "sby", label: "Surabaya" },
  { value: "yog", label: "Yogyakarta", disabled: true }, { value: "mdn", label: "Medan" },
];

describe("filterOptions / nextEnabled", () => {
  it("matches anywhere in the label, those that start with the text first", () => {
    expect(filterOptions(OPTS, "a").slice(0, 1).map((o) => o.value)).toEqual(["jkt"]);
    expect(filterOptions(OPTS, "dung").map((o) => o.value)).toEqual(["bdg"]);
    expect(filterOptions(OPTS, "  ").length).toBe(5);
  });
  it("skips disabled options and wraps", () => {
    expect(nextEnabled(OPTS, 2, 1)).toBe(4);
    expect(nextEnabled(OPTS, 4, 1)).toBe(0);
    expect(nextEnabled(OPTS, 0, -1)).toBe(4);
  });
});

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });
async function mount(el: ReturnType<typeof h>) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(el));
}
const input = () => document.querySelector<HTMLInputElement>('[role="combobox"]')!;
const options = () => [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);
const type = (v: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), v);
  input().dispatchEvent(new Event("input", { bubbles: true }));
});
const key = (k: string) => act(async () => { input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); });

function Single({ onChange }: { onChange?: (v: ComboOption | null) => void }) {
  const [v, setV] = useState<ComboOption | null>(null);
  return h(Combobox, { label: "City", options: OPTS, value: v, onChange: (x: ComboOption | null) => { setV(x); onChange?.(x); } });
}
function Multi({ onCreate }: { onCreate?: (t: string) => ComboOption }) {
  const [v, setV] = useState<ComboOption[]>([]);
  return h(Combobox, { label: "Cities", multiple: true, options: OPTS, value: v, onChange: setV, onCreate });
}

describe("Combobox (single)", () => {
  it("typing filters; ↓ then Enter picks the active option and shows its label; the field is a combobox over a listbox", async () => {
    const onChange = vi.fn();
    await mount(h(Single, { onChange }));
    expect(input().getAttribute("aria-expanded")).toBe("false");
    await type("ba");
    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(options()).toEqual(["Bandung", "Surabaya"]);
    await key("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).toMatch(/-opt-1$/);
    await key("Enter");
    expect(onChange).toHaveBeenCalledWith({ value: "sby", label: "Surabaya" });
    expect(input().value).toBe("Surabaya");
    expect(document.querySelector('[role="listbox"]')!.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector('[aria-label="Clear City"]')).not.toBeNull();
  });
  it("Esc closes the list; the result count is announced", async () => {
    await mount(h(Single));
    await type("a");
    expect(document.querySelector('[role="status"]')!.textContent).toBe("5 options"); // Jakarta, Bandung, Surabaya, Yogyakarta (disabled, still listed), Medan
    await key("Escape");
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Combobox (multiple)", () => {
  it("picks become chips (and leave the list); Backspace on an empty field removes the last; each chip has a named remove button", async () => {
    await mount(h(Multi));
    await type("jak"); await key("Enter");
    await type("med"); await key("Enter");
    expect([...document.querySelectorAll('button[aria-label^="Remove"]')].map((b) => b.getAttribute("aria-label"))).toEqual(["Remove Jakarta", "Remove Medan"]);
    await type("");
    expect(options()).not.toContain("Jakarta");
    await key("Backspace");
    expect(document.querySelector('[aria-label="Remove Medan"]')).toBeNull();
  });
  it("onCreate offers the typed text when nothing has that label", async () => {
    await mount(h(Multi, { onCreate: (t: string) => ({ value: t.toLowerCase(), label: t }) }));
    await type("Bali");
    expect(options()).toContain("Create “Bali”");
    await key("Enter");
    expect(document.querySelector('[aria-label="Remove Bali"]')).not.toBeNull();
  });
});

describe("Combobox (server search)", () => {
  it("loads after the debounce with the typed query; a failure offers Try again", async () => {
    const load = vi.fn(async (q: string) => OPTS.filter((o) => o.label.toLowerCase().startsWith(q.toLowerCase())));
    function Remote() { const [v, setV] = useState<ComboOption | null>(null); return h(Combobox, { label: "City", loadOptions: load, value: v, onChange: setV }); }
    await mount(h(Remote));
    await type("su");
    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    expect(load).toHaveBeenLastCalledWith("su", expect.any(AbortSignal));
    expect(options()).toEqual(["Surabaya"]);
    load.mockRejectedValueOnce(new Error("down"));
    await type("me");
    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    expect(document.querySelector('[role="listbox"]')!.textContent).toContain("Couldn't load the options.");
  });
});
