"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import { Icon } from "../ui/icon";
import { SpinnerIcon } from "../ui/icons";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { type ActionInput, validateActionInput, validateConfirmText } from "../lib/action-input";

type Props = {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; description: string; impact: string[]; reasons: readonly string[]; actionLabel: string;
  destructive?: boolean; confirmText?: string;
  /** Set while the action can't run (obs-agent down): the action button is off and the reason is shown. */
  unavailableReason?: string;
  /** Fields above the impact box (e.g. the domain of an allowlist change). */
  lead?: ReactNode;
  /** Extra fields above the typed confirmation (e.g. "Also reset MFA"). */
  extra?: ReactNode;
  /**
   * false: a user's own action (Change MFA device), not an admin action: no Reason, Audit note or Change ticket; the
   * typed confirmation (and the caller's `extra` fields) remain. Default true.
   */
  auditFields?: boolean;
  /**
   * Long-running action (up to ~90 s): shown while it runs, and the dialog may then be
   * closed. The request keeps going; `onConfirm` reports the outcome itself (toast), since the dialog is gone.
   */
  pendingNote?: string;
  onConfirm?: (v: ActionInput, o: { detached: () => boolean }) => Promise<void>;
  /** Where focus goes after closing (opened from a menu item that no longer exists, Radix can't return focus itself). */
  onCloseAutoFocus?: (e: Event) => void;
};

const FIELD = "grid gap-1.5";
const LABEL = "text-label text-fg";
const ERR = "text-body-sm text-down-ink";

/** Risky-action confirmation (spec §7): impact, required reason, audit note, optional ticket, optional typed name. */
export function ConfirmActionDialog(p: Props) {
  const id = useId();
  const [v, setV] = useState<ActionInput>({ reason: "", note: "", ticket: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ActionInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false); // the body is scrolled down: the header shows its hairline
  const detached = useRef(false);
  const set = (k: keyof ActionInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  function close() {
    setV({ reason: "", note: "", ticket: "", confirm: "" }); setErrors({}); setFailure(null); setScrolled(false);
    p.onOpenChange(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p.unavailableReason || !p.onConfirm) return;
    const errs = p.auditFields === false ? validateConfirmText(v, p.confirmText) : validateActionInput(v, { reasons: p.reasons, confirmText: p.confirmText });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFailure(null); detached.current = false;
    try { await p.onConfirm(v, { detached: () => detached.current }); if (!detached.current) close(); }
    catch (err) { if (!detached.current) setFailure(err instanceof Error ? err.message : "The action didn't complete. Try again."); }
    finally { setBusy(false); }
  }

  /** Close while a long action runs: the form stays as it is (the component unmounts); the outcome arrives as a toast. */
  function detach() {
    detached.current = true; setScrolled(false);
    p.onOpenChange(false);
  }
  const canDetach = busy && !!p.pendingNote;

  return (
    <Dialog open={p.open} onOpenChange={(o) => {
      if (busy) { if (!o && canDetach) detach(); return; }
      if (o) p.onOpenChange(true); else close();
    }}>
      {/* Capped at the viewport: header and footer stay put, the fields scroll (the T4c Open dialog is ~950 px tall). */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[minmax(0,1fr)]" onCloseAutoFocus={p.onCloseAutoFocus}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          {/* 16 + 1 + 3 px keeps the 20 px gap of a dialog that fits; the rule shows only while the body is scrolled. */}
          <DialogHeader className="shrink-0 border-b border-transparent pb-4 transition-colors duration-(--dur-fast) data-scrolled:border-line" data-scrolled={scrolled || undefined}>
            <DialogTitle>{p.title}</DialogTitle>
            <DialogDescription>{p.description}</DialogDescription>
          </DialogHeader>
          <div className="scroll-quiet grid min-h-0 gap-4 overflow-y-auto px-6 pt-0.75 pb-5" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>
            {p.lead}
            {p.impact.length > 0 && (
              <div className="grid gap-1.5 rounded-lg border border-line bg-tray px-3 py-2.5 text-body-sm text-fg-2">
                <span>Impact</span>
                <ul className="grid gap-1">{p.impact.map((x) => <li key={x} className="font-medium text-fg">{x}</li>)}</ul>
              </div>
            )}
            {p.auditFields !== false && <>
              <div className={FIELD}>
                <label htmlFor={`${id}-r`} className={LABEL}>Reason</label>
                <Select id={`${id}-r`} value={v.reason} onChange={set("reason")} aria-invalid={!!errors.reason || undefined} aria-describedby={errors.reason ? `${id}-r-e` : undefined}>
                  <option value="">Select a reason</option>
                  {p.reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
                {errors.reason && <span id={`${id}-r-e`} className={ERR}>{errors.reason}</span>}
              </div>
              <div className={FIELD}>
                <label htmlFor={`${id}-n`} className={LABEL}>Audit note</label>
                <textarea id={`${id}-n`} value={v.note} onChange={set("note")} rows={3} maxLength={500} aria-invalid={!!errors.note || undefined} aria-describedby={errors.note ? `${id}-n-e` : undefined}
                  className="rounded-md border border-line-strong bg-card px-2.5 py-2 text-body text-fg outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft aria-invalid:border-down-mark" />
                {errors.note && <span id={`${id}-n-e`} className={ERR}>{errors.note}</span>}
              </div>
              <div className={FIELD}>
                <label htmlFor={`${id}-t`} className={LABEL}>Change ticket <span className="font-normal text-fg-3">(optional)</span></label>
                <Input id={`${id}-t`} value={v.ticket} onChange={set("ticket")} placeholder="CR-2026-0418" className="font-mono" aria-invalid={!!errors.ticket || undefined} aria-describedby={errors.ticket ? `${id}-t-e` : undefined} />
                {errors.ticket && <span id={`${id}-t-e`} className={ERR}>{errors.ticket}</span>}
              </div>
            </>}
            {p.extra}
            {p.confirmText && (
              <div className={FIELD}>
                <label htmlFor={`${id}-c`} className={LABEL}>Type <span className="font-mono">{p.confirmText}</span> to continue</label>
                <Input id={`${id}-c`} value={v.confirm} onChange={set("confirm")} autoComplete="off" className="font-mono" aria-invalid={!!errors.confirm || undefined} aria-describedby={errors.confirm ? `${id}-c-e` : undefined} />
                {errors.confirm && <span id={`${id}-c-e`} className={ERR}>{errors.confirm}</span>}
              </div>
            )}
            {p.unavailableReason && <p className="rounded-md bg-primary-soft px-3 py-2 text-body-sm text-primary-ink">{p.unavailableReason}</p>}
            {busy && p.pendingNote && <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-body-sm text-primary-ink">{p.pendingNote}</p>}
            {failure && <p role="alert" className="rounded-md bg-down-soft px-3 py-2 text-body-sm text-down-ink">{failure}</p>}
          </div>
          <DialogFooter className="shrink-0">
            {canDetach
              ? <Button type="button" variant="ghost" onClick={detach}>Close</Button>
              : <Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button>}
            <Button type="submit" variant={p.destructive ? "destructive" : "default"} disabled={busy || !!p.unavailableReason || !p.onConfirm}>
              {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}{p.actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
