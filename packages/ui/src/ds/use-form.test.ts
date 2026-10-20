// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rules } from "../lib/validate";
import { ErrorSummary } from "./error-summary";
import { Field } from "./field";
import { useForm } from "./use-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const SCHEMA = { name: [rules.required("Enter a name.")], email: [rules.required("Enter an email."), rules.email()] };

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });

function Form({ onValid }: { onValid: (v: { name: string; email: string }) => void }) {
  const f = useForm({ initial: { name: "", email: "" }, schema: SCHEMA, idPrefix: "t" });
  return h("form", { onSubmit: f.submit(onValid) },
    h(ErrorSummary, { errors: f.shown, idPrefix: "t" }),
    h(Field, { id: f.id("name"), label: "Name", error: f.error("name"), children: h("input", f.text("name")) }),
    h(Field, { id: f.id("email"), label: "Email", error: f.error("email"), children: h("input", f.text("email")) }),
    h("button", { type: "submit" }, "Save"));
}
async function mount(onValid = vi.fn()) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(h(Form, { onValid })));
  return onValid;
}
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const type = (el: HTMLInputElement, v: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const raf = () => act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });

describe("useForm", () => {
  it("no error while typing; it shows after the field is left, and clears as soon as it is fixed", async () => {
    await mount();
    await type(input("t-email"), "rina@");
    expect(document.getElementById("t-email-error")).toBeNull();
    await act(async () => { input("t-email").dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(document.getElementById("t-email-error")!.textContent).toBe("Enter an email address like name@example.com.");
    await type(input("t-email"), "rina@example.com");
    expect(document.getElementById("t-email-error")).toBeNull();
  });

  it("a failed submit shows every error, a summary that is announced, focuses the first field, and doesn't call onValid", async () => {
    const onValid = await mount();
    await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await raf();
    expect(onValid).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')!.textContent).toContain("Enter a name.");
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    expect(document.activeElement).toBe(input("t-name"));
  });

  it("a valid submit calls onValid with the values", async () => {
    const onValid = await mount();
    await type(input("t-name"), "Rina");
    await type(input("t-email"), "rina@example.com");
    await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(onValid).toHaveBeenCalledWith({ name: "Rina", email: "rina@example.com" });
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});
