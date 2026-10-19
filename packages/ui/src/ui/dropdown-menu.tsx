"use client";

import type { ComponentProps } from "react";
import { deferredOverlay } from "./deferred-overlay";

/**
 * Menus (spec §5.14). The Radix implementation (./dropdown-menu-impl) is a deferred chunk: it loads after hydration
 * or on the first hover, focus or press, so it stays out of every route's first-load JS (deferred-overlay.tsx).
 * Same API and markup as before.
 */
const menu = deferredOverlay("menu", "dropdown-menu-trigger", () => import("./dropdown-menu-impl"));

export const DropdownMenu = menu.Root;
export const DropdownMenuTrigger = menu.Trigger;
export const DropdownMenuPortal = menu.part("DropdownMenuPortal");
const Content = menu.part("DropdownMenuContent");
const FIRST_ITEM = ["menuitem", "menuitemradio", "menuitemcheckbox"].map((r) => `[role="${r}"]:not([data-disabled])`).join(",");

/**
 * Opened by a key press on the stand-in: move focus to the first enabled item, as Radix does for a keyboard open (its
 * root mounted after that keydown, so it treats the open as a pointer one and focuses the menu itself). Done when the
 * menu takes its initial focus, through the public `ref` only.
 */
export function DropdownMenuContent({ ref, ...props }: ComponentProps<typeof Content>) {
  const takeKeyOpen = menu.useTakeKeyOpen();
  const attach = (el: HTMLDivElement | null) => {
    if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
    if (!el || !takeKeyOpen()) return;
    el.addEventListener("focus", () => { if (document.activeElement === el) el.querySelector<HTMLElement>(FIRST_ITEM)?.focus(); }, { once: true });
  };
  return <Content {...props} ref={attach} />;
}
export const DropdownMenuGroup = menu.part("DropdownMenuGroup");
export const DropdownMenuLabel = menu.part("DropdownMenuLabel");
export const DropdownMenuItem = menu.part("DropdownMenuItem");
export const DropdownMenuCheckboxItem = menu.part("DropdownMenuCheckboxItem");
export const DropdownMenuRadioGroup = menu.part("DropdownMenuRadioGroup");
export const DropdownMenuRadioItem = menu.part("DropdownMenuRadioItem");
export const DropdownMenuSeparator = menu.part("DropdownMenuSeparator");
export const DropdownMenuShortcut = menu.part("DropdownMenuShortcut");
export const DropdownMenuSub = menu.part("DropdownMenuSub");
export const DropdownMenuSubTrigger = menu.part("DropdownMenuSubTrigger");
export const DropdownMenuSubContent = menu.part("DropdownMenuSubContent");
/** The chunk loader (tests: load it without a root). */
export const menuLoader = menu.loader;
