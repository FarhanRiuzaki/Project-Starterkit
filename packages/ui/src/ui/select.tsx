import * as React from "react";
import { cn } from "../lib/cn";

/** Native select styled like Input (32 px, radius 8, strong line, card fill; primary focus ring; Down mark when aria-invalid). */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 rounded-md border border-line-strong bg-card px-2.5 text-body text-fg outline-none",
        "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft aria-invalid:border-down-mark",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
