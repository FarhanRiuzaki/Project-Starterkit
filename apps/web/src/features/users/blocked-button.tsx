import type { ComponentProps } from "react";
import { Button } from "@starterkit/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starterkit/ui/ui/tooltip";

/** A button that is off because a protection rule blocks it: it stays visible and the tooltip says why. */
export function BlockedButton({ reason, children, ...props }: ComponentProps<typeof Button> & { reason: string | null }) {
  if (!reason) return <Button {...props}>{children}</Button>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label={`${typeof children === "string" ? children : "Action"} is unavailable. ${reason}`}>
          <Button {...props} disabled aria-hidden="true" tabIndex={-1}>{children}</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
