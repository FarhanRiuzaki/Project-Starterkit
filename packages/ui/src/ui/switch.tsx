import { cn } from "../lib/cn";

/**
 * Switch (Apple HIG toggle): for a setting that applies at once (no Save), on or off. A 36 × 20 pill, primary when on,
 * a 16 px card knob that slides (DUR.fast; no slide under reduced motion). role="switch" with aria-checked; Space or
 * Enter toggles; the label is the setting's name, never "On/Off". In a form that saves later, use a Checkbox instead.
 * A 28 px hit area around the pill (44 px under a coarse pointer, base.css).
 */
export function Switch({ checked, onChange, label, disabled, describedBy, className }: {
  checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; describedBy?: string; className?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-describedby={describedBy} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("group inline-grid h-7 shrink-0 cursor-pointer place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50", className)}>
      <span aria-hidden="true" className={cn("relative h-5 w-9 rounded-full transition-colors duration-(--dur-fast)", checked ? "bg-primary" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-card shadow-sm transition-transform duration-(--dur-fast) ease-standard motion-reduce:transition-none",
          checked && "translate-x-4")} />
      </span>
    </button>
  );
}
