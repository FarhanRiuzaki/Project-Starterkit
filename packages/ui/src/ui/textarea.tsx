import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" {...props} className={cn("min-h-28 w-full min-w-0 resize-y rounded-md border border-control-border bg-card p-3 text-body text-fg placeholder:text-fg-3 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft focus-visible:outline-none read-only:bg-inset disabled:opacity-50 aria-invalid:border-down-mark aria-invalid:focus-visible:ring-down-soft", className)} />;
}
