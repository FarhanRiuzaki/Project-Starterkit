import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";
import { ReorderGroup } from "./reorder";
import { staggerDelay } from "./tokens";

/**
 * Staggered reveal for card grids, KPI trays and legend cards (spec §7.2): opacity + 6 px rise over --dur-enter,
 * 35 ms per item, capped at 8 staggered items. Never for table rows (tables fade in once) or lists with > 20
 * siblings (§7.7). CSS keyframes (`animate-enter` + animation-delay), not `m.*`: the items are visible in the server
 * HTML and never wait for JavaScript or the lazy motion chunk. Reduced motion: opacity only, 100 ms, no delay.
 * `Stagger` is the container (it can be the grid itself); each child is a `StaggerItem` with its index.
 * For a container whose children cannot be wrapped (StatTiles), the `stagger-children` utility does the same by
 * nth-child.
 * `reorder` (card grids such as Fleet): items glide to their new place when sort / filter reorders them (Framer
 * spring once the deferred layer is loaded; skipped above 60 items and under reduced motion). Give each
 * `StaggerItem` a stable `key`.
 */
export function Stagger({ children, className, as = "div", label, reorder = false }: {
  children: ReactNode; className?: string; as?: "div" | "ul" | "ol"; label?: string; reorder?: boolean;
}) {
  if (reorder) return <ReorderGroup className={className} as={as} label={label}>{children}</ReorderGroup>;
  const C = as;
  return <C className={className} aria-label={label}>{children}</C>;
}

export function StaggerItem({ index, children, className, as = "div" }: {
  index: number; children: ReactNode; className?: string; as?: "div" | "li";
}) {
  const C = as;
  const style = { animationDelay: `${staggerDelay(index)}s` } satisfies CSSProperties;
  return <C className={cn("animate-enter", className)} style={style}>{children}</C>;
}
