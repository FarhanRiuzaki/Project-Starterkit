// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./password-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });
async function mount(props: Record<string, unknown> = {}) {
  const form = document.createElement("form");
  form.addEventListener("submit", (e) => e.preventDefault());
  document.body.append(form);
  root = createRoot(form);
  await act(async () => root!.render(h(PasswordInput, { id: "pw", "aria-describedby": "pw-note", ...props })));
  return { form, input: form.querySelector("input")!, toggle: form.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')! };
}
const key = (input: HTMLInputElement, type: "keydown" | "keyup", caps: boolean) => act(async () => {
  const e = new KeyboardEvent(type, { key: "a", bubbles: true });
  Object.defineProperty(e, "getModifierState", { value: (k: string) => k === "CapsLock" && caps });
  input.dispatchEvent(e);
});

describe("PasswordInput", () => {
  it("is masked by default; the toggle is a non-submitting button that shows and hides the password", async () => {
    const { input, toggle } = await mount();
    expect(input.type).toBe("password");
    expect(toggle.type).toBe("button");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    await act(async () => toggle.click());
    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await act(async () => toggle.click());
    expect(input.type).toBe("password");
  });

  it("masks again when its form submits", async () => {
    const { form, input, toggle } = await mount();
    await act(async () => toggle.click());
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(input.type).toBe("password");
  });

  it("says Caps Lock is on while it is, described by the field after the caller's note", async () => {
    const { input } = await mount();
    await key(input, "keydown", true);
    const note = [...document.querySelectorAll("span")].find((s) => s.textContent === "Caps Lock is on.")!;
    expect(input.getAttribute("aria-describedby")).toBe(`pw-note ${note.id}`);
    await key(input, "keyup", false);
    expect(document.body.textContent).not.toContain("Caps Lock is on.");
    expect(input.getAttribute("aria-describedby")).toBe("pw-note");
  });

  it("keeps the caller's ref and handlers", async () => {
    const ref = vi.fn(), onKeyDown = vi.fn();
    const { input } = await mount({ ref, onKeyDown });
    expect(ref).toHaveBeenCalledWith(input);
    await key(input, "keydown", false);
    expect(onKeyDown).toHaveBeenCalled();
  });
});
