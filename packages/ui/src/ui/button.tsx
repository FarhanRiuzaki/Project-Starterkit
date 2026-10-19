import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { Slot } from "radix-ui";

/**
 * Buttons (spec §5.3): radius 8, 32 px (28 sm), padding 0 12, 14/500, icon 16 + 6 gap; press scale 0.98 (100 ms),
 * hover fill 150 ms. `default` = the one primary per page (--action, near-black / near-white); `secondary` = card
 * + strong line + shadow-xs; `ghost`; `destructive` = Danger (card, Down ink, Down mark @ 40 % border).
 * `outline` is kept as an alias of secondary for older callers.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-body font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-(--dur-fast) ease-standard outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[.98] active:duration-(--dur-instant) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-action text-action-fg hover:bg-action-hover",
        secondary: "border-line-strong bg-card text-fg shadow-xs hover:bg-tray",
        outline: "border-line-strong bg-card text-fg shadow-xs hover:bg-tray",
        ghost: "border-transparent bg-transparent text-fg-2 hover:bg-tray hover:text-fg",
        destructive: "border-down-mark/40 bg-card text-down-ink shadow-xs hover:bg-down-soft",
        link: "h-auto border-transparent px-0 text-primary-ink underline-offset-4 hover:underline motion-safe:active:scale-100",
      },
      size: {
        sm: "h-7 px-2.5 text-body-sm [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-8 px-3",
        lg: "h-9 px-3.5",
        "icon-sm": "size-7",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className, variant = "default", size = "default", asChild = false, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
