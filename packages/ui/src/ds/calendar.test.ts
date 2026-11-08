// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";
// Test date navigation independently of the deferred menu; browser tests exercise the real custom menus.
vi.mock("./time-range-parts", () => ({ TimeRangeSelect: ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) => h("select", { "aria-label": label, value, onChange: (e: { target: HTMLSelectElement }) => onChange(e.target.value) }, options.map(option => h("option", { key: option.value, value: option.value }, option.label))) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ""; });
async function mount(props: Parameters<typeof Calendar>[0]) { const el = document.createElement("div"); document.body.append(el); root = createRoot(el); await act(async () => root.render(h(Calendar, props))); return el; }
async function choose(el: HTMLElement, label: string, value: string) { const input = el.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; input.value = value; await act(async () => input.dispatchEvent(new Event("change", { bubbles: true }))); }
it("jumps directly by month and year, clamps leap days and commits only a chosen day", async () => {
  const onValueChange = vi.fn();
  const el = await mount({ value: "2024-01-31", today: "2026-11-08", onValueChange });
  await choose(el, "Choose month", "02");
  expect(el.querySelector('[data-date="2024-02-29"]')?.getAttribute("tabindex")).toBe("0");
  await choose(el, "Choose year", "2030");
  expect(el.querySelector('[data-date="2030-02-28"]')?.getAttribute("tabindex")).toBe("0");
  expect(onValueChange).not.toHaveBeenCalled();
  await act(async () => el.querySelector<HTMLButtonElement>('[data-date="2030-02-28"]')!.click());
  expect(onValueChange).toHaveBeenCalledWith("2030-02-28");
});
it("limits month/year choices to bounds and clamps the focused date at each boundary", async () => {
  const el = await mount({ value: "2025-01-31", today: "2026-11-08", min: "2024-04-15", max: "2026-09-10", onValueChange: vi.fn() });
  const values = (label: string) => [...el.querySelectorAll<HTMLOptionElement>(`[aria-label="${label}"] option`)].map(option => option.value);
  expect(values("Choose year")).toEqual(["2024", "2025", "2026"]);
  await choose(el, "Choose year", "2024");
  expect(el.querySelector('[data-date="2024-04-15"]')?.getAttribute("tabindex")).toBe("0");
  expect(values("Choose month")).not.toContain("03");
  expect(el.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!.disabled).toBe(true);
  await choose(el, "Choose year", "2026");
  expect(values("Choose month")).not.toContain("10");
  await choose(el, "Choose month", "09");
  expect(el.querySelector('[data-date="2026-09-10"]')?.getAttribute("tabindex")).toBe("0");
  expect(el.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!.disabled).toBe(true);
});
