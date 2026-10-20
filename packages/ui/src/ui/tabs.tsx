"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { Tabs as TabsPrimitive } from "radix-ui";
import { SharedIndicator, useMotionLayer } from "../motion";
import { useIndicator } from "./use-indicator";

/** Active tab + per-instance `layoutId` for the Framer indicator, and the list variant (set by TabsList). */
const TabsCtx = React.createContext<{ active?: string; layoutId: string; variant: "line" | "default" }>({ layoutId: "", variant: "line" });

function Tabs({ className, orientation = "horizontal", value, defaultValue, onValueChange, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  // Mirrors Radix's selection (controlled or not) so the active trigger can host the shared-layout indicator.
  const [inner, setInner] = React.useState(defaultValue);
  const layoutId = `tab-${React.useId()}`;
  const ctx = React.useMemo(() => ({ active: value ?? inner, layoutId, variant: "line" as const }), [value, inner, layoutId]);
  return (
    <TabsCtx.Provider value={ctx}>
      <TabsPrimitive.Root data-slot="tabs" data-orientation={orientation} orientation={orientation} value={value} defaultValue={defaultValue}
        onValueChange={(v) => { setInner(v); onValueChange?.(v); }}
        className={cn("flex min-w-0 flex-col gap-section", className)} {...props} />
    </TabsCtx.Provider>
  );
}

const tabsListVariants = cva("relative inline-flex w-full items-center", {
  variants: {
    variant: {
      // The 1 px baseline is an inset shadow, not border-b: the list scrolls (overflow clips at the padding box), so an
      // underline at `bottom: -1px` over a border would be cut off. Drawn inside, the underline (bottom 0) covers it.
      line: "scroll-quiet gap-5 overflow-x-auto shadow-[inset_0_-1px_0_var(--line)]",
      default: "w-fit gap-0 rounded-ctl border border-line bg-tray p-0.5",
    },
  },
  defaultVariants: { variant: "line" },
});

/**
 * Tabs (spec §5.9). `line` (detail pages): 40 px, body 500, fg-2 → active fg with a 2 px fg underline that slides
 * between tabs; `default`: segmented look, a raised thumb that slides. The indicator is one positioned element
 * moved with a CSS transform; before it is measured the active tab draws its own underline / fill. Once the deferred
 * Framer layer is loaded the indicator is a `layoutId` element inside the active trigger (spec §7.3 spring).
 * A count after the label: put a `CountBadge` inside the trigger.
 */
function TabsList({ className, variant = "line", children, ...props }: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const box = useIndicator(ref, "[role=tab][data-state=active]");
  const kit = useMotionLayer();
  const parent = React.useContext(TabsCtx);
  const v = variant ?? "line";
  const ctx = React.useMemo(() => ({ ...parent, variant: v }), [parent, v]);
  return (
    <TabsCtx.Provider value={ctx}>
    <TabsPrimitive.List ref={ref} data-slot="tabs-list" data-variant={variant} data-indicator={box ? "ready" : undefined}
      className={cn("group/tabs-list", tabsListVariants({ variant }),
        // Until the indicator is measured (server HTML, no JS) the active tab marks itself.
        !box && (variant === "line" ? "[&_[role=tab][data-state=active]]:after:bg-fg" : "[&_[role=tab][data-state=active]]:bg-seg-active [&_[role=tab][data-state=active]]:shadow-sm"),
        className)} {...props}>
      {children}
      {box && !kit && (
        <span aria-hidden="true" data-slot="tabs-indicator"
          className={cn("indicator-move pointer-events-none absolute left-0",
            variant === "line" ? "bottom-0 h-0.5 rounded-xs bg-fg" : "inset-y-0.5 rounded-md bg-seg-active shadow-sm")}
          style={{ transform: `translateX(${box.x}px)`, width: box.width }} />
      )}
    </TabsPrimitive.List>
    </TabsCtx.Provider>
  );
}

function TabsTrigger({ className, children, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { active, layoutId, variant } = React.useContext(TabsCtx);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-fg-2 transition-colors duration-(--dur-fast) outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 data-[state=active]:text-fg [&_svg]:size-4",
        "group-data-[variant=line]/tabs-list:h-10 group-data-[variant=line]/tabs-list:text-body group-data-[variant=line]/tabs-list:font-medium",
        "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:inset-x-0 group-data-[variant=line]/tabs-list:after:bottom-0 group-data-[variant=line]/tabs-list:after:h-0.5 group-data-[variant=line]/tabs-list:after:rounded-xs",
        "group-data-[variant=default]/tabs-list:h-7 group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:px-2.5 group-data-[variant=default]/tabs-list:text-label",
        className,
      )}
      {...props}
    >
      {children}
      {props.value === active && (
        <SharedIndicator layoutId={layoutId} radius={variant === "line" ? 2 : 8}
          className={variant === "line" ? "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-xs bg-fg" : "pointer-events-none absolute inset-0 -z-10 rounded-md bg-seg-active shadow-sm"} />
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("min-w-0 outline-none data-[state=active]:animate-reveal-in", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
