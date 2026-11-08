import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/** Shared tray/card geometry, also usable by error boundaries without interactive panel dependencies. */
export function CardSurface({ children, header, footer, className, bodyClassName, flush, cards }: {
  children: ReactNode; header?: ReactNode; footer?: ReactNode; className?: string; bodyClassName?: string; flush?: boolean; cards?: boolean;
}) {
  return <section className={cn("flex min-w-0 flex-col rounded-xl border border-line bg-tray p-tray", className)}>
    {header}
    {cards ? <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div> :
      <div className={cn("min-w-0 flex-1 rounded-lg border border-line bg-card", flush ? "overflow-clip" : "p-4", bodyClassName)}>{children}</div>}
    {footer}
  </section>;
}
