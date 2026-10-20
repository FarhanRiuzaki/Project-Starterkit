import { type AriaAttributes, cloneElement, type ReactElement } from "react";
import { Icon } from "../ui/icon";
import { FailedIcon } from "../ui/icons";

type Control = ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: AriaAttributes["aria-invalid"] }>;

/**
 * Label, one control, an optional error and an optional note under it. The error (`${id}-error`, Down ink with an icon,
 * never colour alone) and the note (`${id}-note`) are added to the control's `aria-describedby` (after any ids the
 * caller passed, error first), and an error marks the control `aria-invalid`, so both are announced with the field.
 * Show an error after the user has left the field or tried to submit, never while they type (useForm does).
 */
export function Field({ id, label, note, error, children }: { id: string; label: string; note?: string; error?: string | null; children: Control }) {
  const noteId = `${id}-note`, errorId = `${id}-error`;
  const own = children.props["aria-describedby"];
  const describedBy = [own, error ? errorId : null, note ? noteId : null].filter(Boolean).join(" ") || undefined;
  const control = note || error ? cloneElement(children, { "aria-describedby": describedBy, ...(error ? { "aria-invalid": true } : {}) }) : children;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-label text-fg">{label}</label>
      {control}
      {error && <p id={errorId} className="flex items-start gap-1.5 text-body-sm text-down-ink"><Icon icon={FailedIcon} className="mt-0.5 size-3.5 shrink-0" />{error}</p>}
      {note && <span id={noteId} className="text-caption text-fg-3">{note}</span>}
    </div>
  );
}
