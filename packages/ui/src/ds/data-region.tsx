import type { ReactNode } from "react";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "./states";
import { Notice } from "./notice";
import type { IconData } from "../ui/icon";
/** Five-state composition, independent of a query library. Stale retains the last successful content. */
export function DataRegion({ state, children, loading, empty, error, onRetry }: { state: "loading" | "empty" | "error" | "stale" | "data"; children: ReactNode; loading?: ReactNode; empty: { icon: IconData; title: string; description: string }; error?: string; onRetry?: () => void }) {
  if (state === "loading") return <div aria-label="Loading data" aria-busy="true">{loading ?? <div className="grid gap-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-24 w-full" /></div>}</div>;
  if (state === "empty") return <EmptyState {...empty} />;
  if (state === "error") return <ErrorState title="Couldn't load data" cause={error ?? "Try again to load this information."} onRetry={onRetry} />;
  return <div className="grid gap-3">{state === "stale" && <Notice tone="warn" live>{error ?? "Showing previous data. Try refreshing."}</Notice>}{children}</div>;
}
