import { type AriaAttributes, cloneElement, type ReactElement } from "react";
import { cn } from "../lib/cn";
import { Icon } from "../ui/icon";
import { FailedIcon } from "../ui/icons";

type Control = ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: AriaAttributes["aria-invalid"]; "aria-required"?: AriaAttributes["aria-required"] }>;

/**
 * Label, one control, an optional error and an optional note under it. The error (`${id}-error`, Down ink with an icon,
 * never colour alone) and the note (`${id}-note`) are added to the control's `aria-describedby` (after any ids the
 * caller passed, error first), and an error marks the control `aria-invalid`, so both are announced with the field.
 * Show an error after the user has left the field or tried to submit, never while they type (useForm does).
 * `required` puts a red asterisk after the label (hidden from screen readers) and marks the control `aria-required`, so
 * it is announced as required without the browser's own required pop-up; the form says once what the asterisk means
 * (RequiredNote). `optional` adds a muted "(optional)" instead (Baymard: mark both kinds, so neither is guessed).
 */
export function Field({ id, label, note, error, required, optional, children }: {
  id: string; label: string; note?: string; error?: string | null; required?: boolean; optional?: boolean; children: Control;
}) {
  const noteId = `${id}-note`, errorId = `${id}-error`;
  const own = children.props["aria-describedby"];
  const describedBy = [own, error ? errorId : null, note ? noteId : null].filter(Boolean).join(" ") || undefined;
  const control = note || error || required
    ? cloneElement(children, { "aria-describedby": describedBy, ...(error ? { "aria-invalid": true } : {}), ...(required ? { "aria-required": true } : {}) })
    : children;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-label text-fg">{label}{required && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}{optional && <span className="font-normal text-fg-3"> (optional)</span>}</label>
      {control}
      {error && <p id={errorId} className="flex items-start gap-1.5 text-body-sm text-down-ink"><Icon icon={FailedIcon} className="mt-0.5 size-3.5 shrink-0" />{error}</p>}
      {note && <span id={noteId} className="text-caption text-fg-3">{note}</span>}
    </div>
  );
}

/** Said once at the top of a form that marks required fields: what the asterisk means. */
export function RequiredNote({ className }: { className?: string }) {
  return <p className={cn("text-caption text-fg-3", className)}>Required fields are marked with <span aria-hidden="true" className="text-destructive">*</span><span className="sr-only">an asterisk</span>.</p>;
}
