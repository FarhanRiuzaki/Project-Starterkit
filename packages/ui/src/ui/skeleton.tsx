import { cn } from "../lib/cn";

/** Loading block (spec §5.13, §7.2): --inset with a GPU shimmer sweep, radius 4; static under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("skeleton-shimmer rounded-xs", className)} {...props} />;
}

export { Skeleton };
