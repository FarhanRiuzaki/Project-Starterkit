"use client";

import { type ReactNode, useState } from "react";
import { deferredOverlay } from "./deferred-overlay";

/**
 * Navigation drawer (phone shell). The Radix dialog behind it (./drawer-impl) is a deferred chunk: it loads after
 * hydration or on the first hover, focus or press, so it stays out of every route's first-load JS (deferred-overlay.tsx).
 * Focus trap, Escape, scrim click and focus return are Radix's; the page behind is inert while it is open.
 */
const drawer = deferredOverlay("dialog", "drawer-trigger", () => import("./drawer-impl"));

/** Open state lives here: it closes whenever `closeOn` changes (pass the pathname, so any navigation closes it). */
export function Drawer({ closeOn, children }: { closeOn?: unknown; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(closeOn);
  if (seen !== closeOn) { setSeen(closeOn); setOpen(false); }
  return <drawer.Root open={open} onOpenChange={setOpen}>{children}</drawer.Root>;
}
export const DrawerTrigger = drawer.Trigger;
export const DrawerContent = drawer.part("DrawerContent");
export const DrawerClose = drawer.part("DrawerClose");
/** The chunk loader (tests: load it without a root). */
export const drawerLoader = drawer.loader;
