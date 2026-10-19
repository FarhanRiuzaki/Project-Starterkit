import { cloneElement, type ReactElement } from "react";

/**
 * Label, one control and an optional note under it. The note gets id `${id}-note` and is added to the control's
 * `aria-describedby` (after any ids the caller passed), so a note is always announced with its field.
 */
export function Field({ id, label, note, children }: {
  id: string; label: string; note?: string; children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const noteId = `${id}-note`;
  const own = children.props["aria-describedby"];
  const control = note ? cloneElement(children, { "aria-describedby": own ? `${own} ${noteId}` : noteId }) : children;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-label text-fg">{label}</label>
      {control}
      {note && <span id={noteId} className="text-caption text-fg-3">{note}</span>}
    </div>
  );
}
