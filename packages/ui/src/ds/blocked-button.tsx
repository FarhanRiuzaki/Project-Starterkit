"use client";

import { type ComponentProps, useId } from "react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/**
 * A button that is off because a rule or a missing permission blocks it: it stays focusable (aria-disabled), does
 * nothing, and the reason is its description and tooltip. A touch screen has no hover: under a coarse pointer the
 * reason is a visible caption below the button (CSS only; with a fine pointer the wrapper is `display: contents`, so
 * the layout is the same as a bare button). `caption={false}` for dense rows (table row actions) that show the same
 * reason elsewhere on touch; the reason then stays screen-reader only there.
 * `className` stays on the button, blocked or not. Under a coarse pointer the button and its caption are one box:
 * `wrapClassName` places that box where the button alone would sit (`w-full` beside a full-width button, `ml-auto
 * items-end` for a button pushed right); with a fine pointer the wrapper has no box, so it changes nothing there.
 */
export function BlockedButton({ reason, caption = true, children, onClick, className, wrapClassName, ...props }: ComponentProps<typeof Button> & { reason: string | null; caption?: boolean; wrapClassName?: string }) {
  const id = useId();
  if (!reason) return <Button onClick={onClick} className={className} {...props}>{children}</Button>;
  return (
    // Only `display` changes with the pointer; the flex classes act once the wrapper is a box (coarse).
    <span className={cn("contents flex-col items-start gap-1 pointer-coarse:inline-flex", wrapClassName)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button {...props} aria-disabled="true" aria-describedby={id} onClick={(e) => e.preventDefault()} className={cn("aria-disabled:cursor-default aria-disabled:opacity-50", className)}>{children}</Button>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <span id={id} className={caption ? "sr-only max-w-64 text-caption text-pretty text-fg-3 pointer-coarse:not-sr-only" : "sr-only"}>{reason}</span>
    </span>
  );
}
