// @vitest-environment happy-dom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferredOverlay } from "./deferred-overlay";
import * as Impl from "./dropdown-menu-impl";
import * as PopImpl from "./popover-impl";

vi.mock("../motion/gate", async importOriginal => ({ ...await importOriginal<typeof import("../motion/gate")>(), whenIdle: () => () => {} }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });

for (const controlled of [false, true]) describe(`deferred menu queued handoff (${controlled ? "controlled" : "uncontrolled"})`, () => {
  for (const key of ["Enter", " ", "ArrowDown"]) it(`honors ${JSON.stringify(key)} after preload resolves but before its closed root commits, exactly once`, async () => {
    let resolve!: (module: typeof Impl) => void;
    const pending = new Promise<typeof Impl>(done => { resolve = done; });
    const menu = deferredOverlay("menu", "test-menu-trigger", () => pending);
    const Content = menu.part("DropdownMenuContent"), Item = menu.part("DropdownMenuItem");
    const onChange = vi.fn();
    function Example() {
      const [open, setOpen] = useState(false);
      return h(menu.Root, { ...(controlled ? { open } : { defaultOpen: false }), onOpenChange: next => { onChange(next); setOpen(next); } },
        h(menu.Trigger, { "aria-label": "Account" }, "Account"), h(Content, null, h(Item, null, "Profile")));
    }
    const host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
    await act(async () => root!.render(h(Example)));
    const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Account"]')!;
    await act(async () => trigger.focus()); // starts a held preload
    await act(async () => {
      resolve(Impl);
      // The real loader callbacks queue the closed handoff; act keeps that render uncommitted until the key.
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      expect(document.querySelector('[aria-label="Account"]')).toBe(trigger);
      expect(trigger.id).toBe("");
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(onChange.mock.calls).toEqual([[true]]);
    expect(document.querySelector('[aria-label="Account"]')?.getAttribute("aria-expanded")).toBe("true");
  });
});

it("a controlled owner can reject the queued key request without the menu opening", async () => {
  let resolve!: (module: typeof Impl) => void;
  const menu = deferredOverlay("menu", "test-menu-trigger", () => new Promise<typeof Impl>(done => { resolve = done; }));
  const Content = menu.part("DropdownMenuContent"), Item = menu.part("DropdownMenuItem");
  const onOpenChange = vi.fn();
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root!.render(h(menu.Root, { open: false, onOpenChange }, h(menu.Trigger, { "aria-label": "Account" }, "Account"), h(Content, null, h(Item, null, "Profile")))));
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Account"]')!;
  await act(async () => trigger.focus());
  await act(async () => {
    resolve(Impl); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  expect(onOpenChange.mock.calls).toEqual([[true]]);
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

it("a rejected late key keeps focus when the preload resolved before the stand-in was focused", async () => {
  let resolve!: (module: typeof Impl) => void;
  const menu = deferredOverlay("menu", "test-menu-trigger", () => new Promise<typeof Impl>(done => { resolve = done; }));
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root!.render(h(menu.Root, { open: false }, h(menu.Trigger, { "aria-label": "Account" }, "Account"))));
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Account"]')!;
  await act(async () => {
    trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    resolve(Impl); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  expect(document.activeElement).toBe(document.querySelector('[aria-label="Account"]'));
});

for (const kind of ["menu", "dialog"] as const) it(`transfers a queued ${kind === "menu" ? "pointerdown" : "popover click"} with defaultOpen=false once`, async () => {
  const impl = kind === "menu" ? { Root: Impl.Root, Trigger: Impl.Trigger, Content: Impl.DropdownMenuContent } : { Root: PopImpl.Root, Trigger: PopImpl.Trigger, Content: PopImpl.PopoverContent };
  let resolve!: (module: typeof impl) => void;
  const overlay = deferredOverlay(kind, "test-trigger", () => new Promise<typeof impl>(done => { resolve = done; }));
  const Content = overlay.part("Content");
  const onOpenChange = vi.fn();
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root!.render(h(overlay.Root, { defaultOpen: false, onOpenChange }, h(overlay.Trigger, { "aria-label": "Open" }, "Open"), h(Content, null, "Recorded content"))));
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Open"]')!;
  await act(async () => trigger.focus());
  await act(async () => {
    resolve(impl); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    if (kind === "menu") trigger.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, cancelable: true }));
    else trigger.click();
  });
  expect(document.querySelector(`[role="${kind}"]`)?.textContent).toContain("Recorded content");
  expect(onOpenChange.mock.calls).toEqual([[true]]);
});
