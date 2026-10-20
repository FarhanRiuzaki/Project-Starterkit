import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Brand slot: the app passes its logo nodes (apps/web/src/components/brand); the wordmark when there is room, the
 * mark in a collapsed rail. The nodes carry their own size and accessible name.
 */
export function Brand({ mark, wordmark, collapsed, className }: { mark: ReactNode; wordmark: ReactNode; collapsed?: boolean; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center", className)}>{collapsed ? mark : wordmark}</span>;
}
