import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Input (spec §5.12): 32 px, radius 8, 1 px strong line, card fill, padding 0 10, placeholder fg-3 (format only).
 * Focus: 1 px primary border + 3 px primary-soft ring. Error (`aria-invalid`): Down mark border.
 * Login uses `className="h-10"` (40 px).
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-line-strong bg-card px-2.5 text-body text-fg transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-fg-3",
        "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft",
        "disabled:cursor-not-allowed disabled:bg-inset disabled:opacity-60",
        "aria-invalid:border-down-mark aria-invalid:focus-visible:ring-down-soft",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
