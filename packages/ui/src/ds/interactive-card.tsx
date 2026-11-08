"use client";

import type { ComponentProps, MouseEvent } from "react";
import { Slot } from "radix-ui";
import { cn } from "../lib/cn";
import { CardSurface } from "./card-surface";

export type InteractiveCardProps = ComponentProps<"button"> & { asChild?: boolean };
/** One whole-card action. Compose a link with asChild; put secondary controls outside this card. */
export function InteractiveCard({ asChild, className, disabled, type = "button", onClick, ...props }: InteractiveCardProps) {
  const blocked = disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true" || props["aria-busy"] === true || props["aria-busy"] === "true";
  const Comp = asChild ? Slot.Root : "button";
  return <CardSurface cards bodyClassName="grid">
    <Comp {...props} type={asChild ? undefined : type} disabled={asChild ? undefined : blocked} aria-disabled={blocked || undefined} tabIndex={asChild && blocked ? -1 : props.tabIndex}
      data-slot="interactive-card" className={cn("grid min-w-0 w-full content-start justify-items-start gap-2 rounded-lg border border-line bg-card p-4 text-left text-body text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", blocked ? "cursor-not-allowed opacity-50" : "card-lift cursor-pointer", className)}
      onClickCapture={event => { if (blocked) { event.preventDefault(); event.stopPropagation(); return; } props.onClickCapture?.(event); }}
      onClick={(event: MouseEvent<HTMLButtonElement>) => { if (blocked) { event.preventDefault(); return; } onClick?.(event); }} />
  </CardSurface>;
}
