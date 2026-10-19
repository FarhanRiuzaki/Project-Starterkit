"use client";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { CopyValue } from "./copy-value";

/**
 * A secret shown exactly once (A4 new password): copy button, how to hand it over, nothing stored. The parent holds the
 * secret in component state only and drops it in `onClose`. Only the "Close and clear" button closes: an outside click,
 * Escape or a close icon would throw away a password that has already replaced the old one.
 */
export function SecretOnceDialog({ title, secret, label, notes, warning, onClose, onCloseAutoFocus }: {
  title: string; secret: string; label: string; notes: readonly [string, ...string[]]; warning?: string | null; onClose: () => void;
  /** Where focus goes after closing (the dialog may have replaced another, so Radix can't know the trigger). */
  onCloseAutoFocus?: (e: Event) => void;
}) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}
        onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{notes[0]}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          <div data-testid="secret-once" className="rounded-lg border border-line bg-tray px-3 py-2.5"><CopyValue value={secret} label={label} /></div>
          <ul className="grid list-disc gap-1.5 pl-5 text-body-sm text-fg-2">{notes.slice(1).map((n) => <li key={n}>{n}</li>)}</ul>
          {warning && <p role="alert" className="rounded-md bg-degraded-soft px-3 py-2 text-body-sm text-degraded-ink">{warning}</p>}
        </div>
        <DialogFooter><Button type="button" onClick={onClose}>Close and clear</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
