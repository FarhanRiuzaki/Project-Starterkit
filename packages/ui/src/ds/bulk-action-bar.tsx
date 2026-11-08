"use client";
import { type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
/** Actions are provided by the feature, including confirmation, permissions and recoverable errors. */
export function BulkActionBar({ selectionLabel, scope, onClear, pending, children, className }: { selectionLabel: string; scope: string; onClear: () => void; pending?: boolean; children: ReactNode; className?: string }) {
  return <section aria-label="Bulk actions" aria-busy={pending || undefined} className={cn("grid gap-3 rounded-lg border border-line bg-tray p-4", className)}>
    <div className="flex flex-wrap items-center gap-3"><p className="mr-auto text-label" role="status">{selectionLabel}</p><Button type="button" variant="ghost" disabled={pending} onClick={onClear}>Clear selection</Button>{children}</div>
    <p className="text-caption text-fg-2">{scope}</p>
  </section>;
}
