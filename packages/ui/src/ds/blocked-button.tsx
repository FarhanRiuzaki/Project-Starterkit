"use client";

import { type ComponentProps, useId } from "react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/** A button that is off because a rule or a missing permission blocks it: it stays focusable (aria-disabled), does nothing, and the reason is its description and tooltip. */
export function BlockedButton({ reason, children, onClick, ...props }: ComponentProps<typeof Button> & { reason: string | null }) {
  const id = useId();
  if (!reason) return <Button onClick={onClick} {...props}>{children}</Button>;
  return (
    <Tooltip>
      <span id={id} className="sr-only">{reason}</span>
      <TooltipTrigger asChild>
        <Button {...props} aria-disabled="true" aria-describedby={id} onClick={(e) => e.preventDefault()} className="aria-disabled:cursor-default aria-disabled:opacity-50">{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
