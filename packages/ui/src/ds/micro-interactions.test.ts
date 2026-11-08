// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";
import { Radio, Switch } from "./form-options";
import { StepItem, StepMarker } from "./step-indicator";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ""; root = undefined; });
async function render(node: Parameters<Root["render"]>[0]) {
  if (!root) { const el = document.createElement("div"); document.body.append(el); root = createRoot(el); }
  await act(async () => root!.render(node));
}

it("checkbox confirmation plays only after a change, keeping the focused trigger mounted", async () => {
  await render(h(Checkbox, { checked: true, label: "Selected", onToggle: vi.fn() }));
  const button = document.querySelector("button")!;
  button.focus();
  expect(button.querySelector(".animate-swap")).toBeNull();
  await render(h(Checkbox, { checked: false, label: "Selected", onToggle: vi.fn() }));
  await render(h(Checkbox, { checked: true, label: "Selected", onToggle: vi.fn() }));
  const confirmation = button.querySelector(".animate-swap");
  expect(confirmation).not.toBeNull();
  expect(document.activeElement).toBe(button);
  await render(h(Checkbox, { checked: true, label: "Selected again", onToggle: vi.fn() }));
  expect(button.querySelector(".animate-swap")).toBe(confirmation);
  expect(document.activeElement).toBe(button);
});

it("step completion does not replay on an incidental parent render", async () => {
  await render(h(StepMarker, { status: "current", n: 1 }));
  await render(h(StepMarker, { status: "done", n: 1 }));
  const confirmation = document.querySelector(".animate-swap");
  expect(confirmation).not.toBeNull();
  await render(h(StepMarker, { status: "done", n: 1, className: "size-6" }));
  expect(document.querySelector(".animate-swap")).toBe(confirmation);
});

it.each([Radio, Switch])("read-only native selection never calls its change handler", async Component => {
  const change = vi.fn();
  await render(h(Component, { label: "Managed", "aria-label": "Managed", readOnly: true, checked: true, onChange: change }));
  await act(async () => document.querySelector("input")!.click());
  expect(change).not.toHaveBeenCalled();
  expect(document.querySelector("input")!.checked).toBe(true);
});

it("a composed step still confirms completion when it becomes a revisitable button", async () => {
  await render(h(StepItem, { number: 1, step: { id: "first", label: "Details", status: "current" }, onSelect: vi.fn() }));
  await render(h(StepItem, { number: 1, step: { id: "first", label: "Details", status: "done" }, onSelect: vi.fn() }));
  expect(document.querySelector("button .animate-swap")).not.toBeNull();
});
