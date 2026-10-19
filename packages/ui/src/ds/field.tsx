import type { ReactNode } from "react";

/** Label, control and an optional note under it. The note's id is `${id}-note`, for the control's aria-describedby. */
export function Field({ id, label, note, children }: { id: string; label: string; note?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-label text-fg">{label}</label>
      {children}
      {note && <span id={`${id}-note`} className="text-caption text-fg-3">{note}</span>}
    </div>
  );
}
