"use client";

import { type ComponentProps, useId } from "react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/**
 * A button that is off because a rule or a missing permission blocks it: it stays focusable (aria-disabled), does
 * nothing, and the reason is its description and tooltip. A touch screen has no hover: under a coarse pointer the
 * reason is a visible caption below the button (CSS only; with a fine pointer the wrapper is `display: contents`, so
 * the layout is the same as a bare button). `caption={false}` for dense rows (table row actions) that show the same
 * reason elsewhere on touch; the reason then stays screen-reader only there.
 */
export function BlockedButton({ reason, caption = true, children, onClick, ...props }: ComponentProps<typeof Button> & { reason: string | null; caption?: boolean }) {
  const id = useId();
  if (!reason) return <Button onClick={onClick} {...props}>{children}</Button>;
  return (
    <span className="contents pointer-coarse:inline-flex pointer-coarse:flex-col pointer-coarse:items-start pointer-coarse:gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button {...props} aria-disabled="true" aria-describedby={id} onClick={(e) => e.preventDefault()} className="aria-disabled:cursor-default aria-disabled:opacity-50">{children}</Button>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <span id={id} className={caption ? "sr-only max-w-64 text-caption text-pretty text-fg-3 pointer-coarse:not-sr-only" : "sr-only"}>{reason}</span>
    </span>
  );
}
