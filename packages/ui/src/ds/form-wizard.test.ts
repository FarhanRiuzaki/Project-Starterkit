// @vitest-environment happy-dom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rules } from "../lib/validate";
import { Field } from "./field";
import { FormWizard, ReviewList } from "./form-wizard";
import { useForm } from "./use-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });

function Wizard({ onSubmit }: { onSubmit: (v: unknown) => void }) {
  const f = useForm({ initial: { name: "", email: "" }, schema: { name: [rules.required("Enter a name.")], email: [rules.required("Enter an email.")] }, idPrefix: "w" });
  const [step, setStep] = useState(0);
  return h(FormWizard, {
    label: "New user", submitLabel: "Create user", check: (k: readonly string[]) => f.check(k as ("name" | "email")[]), onSubmit: () => onSubmit(f.values), step, onStepChange: setStep,
    steps: [
      { id: "a", title: "Name", fields: ["name"], content: h(Field, { id: "w-name", label: "Name", error: f.error("name"), children: h("input", f.text("name")) }) },
      { id: "b", title: "Email", fields: ["email"], content: h(Field, { id: "w-email", label: "Email", error: f.error("email"), children: h("input", f.text("email")) }) },
      { id: "c", title: "Review", content: h(ReviewList, { onChange: setStep, rows: [{ label: "Name", value: f.values.name, step: 0 }, { label: "Email", value: f.values.email, step: 1 }] }) },
    ],
  });
}
async function mount(onSubmit = vi.fn()) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(h(Wizard, { onSubmit })));
  return onSubmit;
}
const submit = () => act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
const type = (id: string, v: string) => act(async () => {
  const el = document.getElementById(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const heading = () => document.querySelector("h2")!.textContent;
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === name || b.textContent?.startsWith(name))!;

describe("FormWizard", () => {
  it("Continue validates only this step: an empty name stays on step 1 with its error; filled, it moves on and says Step 2 of 3", async () => {
    await mount();
    expect(document.body.textContent).toContain("Step 1 of 3");
    await submit();
    expect(heading()).toBe("Name");
    expect(document.getElementById("w-name-error")!.textContent).toBe("Enter a name.");
    await type("w-name", "Rina");
    await submit();
    expect(heading()).toBe("Email");
    expect(document.body.textContent).toContain("Step 2 of 3");
    expect(document.getElementById("w-email-error")).toBeNull(); // the next step's errors wait for its own Continue
  });

  it("Back keeps what was typed; the review lists the answers with Change; the last button submits with its action name", async () => {
    const onSubmit = await mount();
    await type("w-name", "Rina"); await submit();
    await act(async () => button("Back").click());
    expect((document.getElementById("w-name") as HTMLInputElement).value).toBe("Rina");
    await submit(); await type("w-email", "rina@example.com"); await submit();
    expect(heading()).toBe("Review");
    expect(document.querySelector("dl")!.textContent).toContain("rina@example.com");
    expect(button("Create user")).toBeTruthy();
    await act(async () => button("Change").click());
    expect(heading()).toBe("Name");
    await submit(); await submit(); await submit();
    expect(onSubmit).toHaveBeenCalledWith({ name: "Rina", email: "rina@example.com" });
  });
});
