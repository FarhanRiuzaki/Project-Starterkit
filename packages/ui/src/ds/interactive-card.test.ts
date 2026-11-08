// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { InteractiveCard } from "./interactive-card";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ""; });
async function mount(node: Parameters<Root["render"]>[0]) { const el = document.createElement("div"); document.body.append(el); root = createRoot(el); await act(async () => root.render(node)); return el; }
it("acts as a native button without submitting its parent form", async () => {
  const onClick = vi.fn();
  const el = await mount(h("form", {}, h(InteractiveCard, { onClick }, "Open details")));
  const button = el.querySelector("button")!;
  expect(button.type).toBe("button");
  await act(async () => button.click());
  expect(onClick).toHaveBeenCalledOnce();
});
it("preserves link semantics when composed and blocks a disabled link's action", async () => {
  const onClick = vi.fn(), childClick = vi.fn();
  const el = await mount(h(InteractiveCard, { asChild: true, disabled: true, onClick, children: h("a", { href: "#details", onClick: childClick }, "Open details") }));
  const link = el.querySelector("a")!;
  expect(link.getAttribute("aria-disabled")).toBe("true");
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  await act(async () => { link.dispatchEvent(click); });
  expect(click.defaultPrevented).toBe(true);
  expect(onClick).not.toHaveBeenCalled();
  expect(childClick).not.toHaveBeenCalled();
  expect(link.classList.contains("card-lift")).toBe(false);
});
