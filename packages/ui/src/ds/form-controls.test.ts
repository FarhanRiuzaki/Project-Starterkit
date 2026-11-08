// @vitest-environment happy-dom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CategoryChip } from "./badges";
import { Field } from "./field";
import { InputAffix, NumberInput } from "./form-controls";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ""; });
async function mount(node: Parameters<Root["render"]>[0]) { const el = document.createElement("div"); document.body.append(el); root = createRoot(el); await act(async () => root.render(node)); return el; }
it("number stepping keeps decimal precision and disables only the reached boundary without submitting", async () => {
  function Demo() { const [value, set] = useState<number | "">(0.2); return h(NumberInput, { label: "weight", value, onValueChange: set, min: 0, max: 0.3, step: 0.1 }); }
  const el = await mount(h(Demo));
  const [minus, plus] = [...el.querySelectorAll("button")];
  await act(async () => plus!.click());
  expect(el.querySelector("input")!.value).toBe("0.3"); expect(plus!.disabled).toBe(true); expect(minus!.disabled).toBe(false);
  expect(plus!.type).toBe("button");
  await act(async () => minus!.click()); expect(el.querySelector("input")!.value).toBe("0.2");
});
it("a disabled number input cannot be stepped", async () => {
  const onValueChange = vi.fn();
  const el = await mount(h(NumberInput, { label: "seats", value: 1, onValueChange, disabled: true }));
  await act(async () => el.querySelector("button")!.click()); expect(onValueChange).not.toHaveBeenCalled();
});
it("a read-only number input cannot be changed by its step buttons", async () => {
  const onValueChange = vi.fn();
  const el = await mount(h(NumberInput, { label: "seats", value: 12, onValueChange, readOnly: true }));
  expect(el.querySelector("input")!.readOnly).toBe(true);
  for (const button of el.querySelectorAll("button")) {
    expect(button.disabled).toBe(true);
    await act(async () => button.click());
  }
  expect(onValueChange).not.toHaveBeenCalled();
});
it("affixes describe the editable value along with the field note; affixes are not part of its submitted value", async () => {
  const el = await mount(h(Field, { id: "cost", label: "Budget", note: "Use a positive amount.", children: h(InputAffix, { id: "cost", prefix: "USD", suffix: "/ month", defaultValue: "2500" }) }));
  const input = el.querySelector("input")!;
  expect(input.value).toBe("2500");
  const descriptions = input.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)!.textContent);
  expect(descriptions).toEqual(["Use a positive amount.", "USD / month"]);
});

it("a badge affix stays outside the editable value and supplies a readable description", async () => {
  const el = await mount(h(InputAffix, { defaultValue: "00220283", suffix: h(CategoryChip, { label: "LDAP", slot: "neutral" }) }));
  const input = el.querySelector("input")!;
  expect(input.value).toBe("00220283");
  expect(document.getElementById(input.getAttribute("aria-describedby")!)!.textContent).toBe("LDAP");
});
