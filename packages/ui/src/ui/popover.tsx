"use client";

import { deferredOverlay } from "./deferred-overlay";

/**
 * Popover (spec §5.14). The Radix implementation (./popover-impl) is a deferred chunk: it loads after hydration or on
 * the first hover, focus or press, so it stays out of every route's first-load JS (deferred-overlay.tsx).
 */
const popover = deferredOverlay("dialog", "popover-trigger", () => import("./popover-impl"));

export const Popover = popover.Root;
export const PopoverTrigger = popover.Trigger;
export const PopoverContent = popover.part("PopoverContent");
