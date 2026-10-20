import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Icon } from "../ui/icon";
import { FailedIcon } from "../ui/icons";

export type RadioOption<T extends string> = { value: T; label: string; description?: ReactNode; disabled?: boolean };

/**
 * One choice of a few (2–6; more → Combobox): native radios in a fieldset with its legend, so arrow keys move the
 * choice and a screen reader hears "1 of 3". `variant="list"` = rows; `variant="cards"` = bordered cards (selected
 * card: primary border on --primary-soft), for options that need a sentence each. A 16 px circle in a 28 px target.
 * `error` (a message) marks the group invalid and describes it.
 */
export function RadioGroup<T extends string>({ name, legend, options, value, onChange, variant = "list", error, className }: {
  name: string; legend: string; options: readonly RadioOption<T>[]; value: T | ""; onChange: (v: T) => void;
  variant?: "list" | "cards"; error?: string | null; className?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined} className={cn("grid gap-2", className)}>
      <legend className="mb-1.5 text-label text-fg">{legend}</legend>
      <div className={cn(variant === "cards" ? "grid gap-2 sm:grid-cols-2" : "grid gap-1")}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value} className={cn("flex cursor-pointer items-start gap-2.5 text-body text-fg has-disabled:cursor-not-allowed has-disabled:opacity-60",
              variant === "cards" ? cn("rounded-lg border px-3 py-2.5 transition-colors duration-(--dur-fast)", on ? "border-primary bg-primary-soft" : "border-line-strong bg-card hover:bg-tray") : "min-h-7 items-center")}>
              <input type="radio" name={name} value={o.value} checked={on} disabled={o.disabled} onChange={() => onChange(o.value)}
                className={cn("grid size-4 shrink-0 cursor-pointer appearance-none place-content-center rounded-full border border-line-strong bg-card outline-none",
                  "before:size-2 before:scale-0 before:rounded-full before:bg-primary-foreground before:transition-transform before:duration-(--dur-fast) checked:border-primary checked:bg-primary checked:before:scale-100",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed", variant === "cards" && "mt-0.5")} />
              <span className="grid min-w-0 gap-0.5">
                <span className={cn(variant === "cards" && "font-medium")}>{o.label}</span>
                {o.description && <span className="text-body-sm text-fg-3">{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p id={errorId} className="flex items-start gap-1.5 text-body-sm text-down-ink"><Icon icon={FailedIcon} className="mt-0.5 size-3.5 shrink-0" />{error}</p>}
    </fieldset>
  );
}
