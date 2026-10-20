"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@starterkit/ui/ui/dialog";

/** One log entry in full (row → detail), read-only. `rows` = label/value pairs; `children` = extra sections (the diff). */
export function EntryDialog({ title, rows, children, onClose }: {
  title: string; rows: [string, ReactNode][]; children?: ReactNode; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Focus the panel, not the first focusable (a copy button or chip whose tooltip would swallow the first Escape). */}
      <DialogContent className="max-w-160" tabIndex={-1} onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus(); }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Log entries are add-only: they can&apos;t be edited or deleted.</DialogDescription>
        </DialogHeader>
        <div className="scroll-quiet grid max-h-[calc(100vh-12rem)] gap-5 overflow-y-auto px-6 py-5">
          <dl className="grid">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-4 border-b border-line py-2 last:border-b-0">
                <dt className="text-label font-normal text-fg-2">{k}</dt>
                <dd className="min-w-0 break-words text-body-sm text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
