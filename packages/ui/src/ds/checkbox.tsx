import { cn } from "../lib/cn";
import { Icon } from "../ui/icon";
import { CheckIcon } from "../ui/icons";

/**
 * Tri-state checkbox: `aria-checked` true / false / "mixed" (a group header with some members on). A 28 px target
 * around a 16 px box; Space or Enter toggles. `readOnly` keeps it focusable so the state can still be read
 * (`aria-readonly`), and clicks do nothing; say why next to the group.
 */
export function Checkbox({ checked, onToggle, label, readOnly, className }: {
  checked: boolean | "mixed"; onToggle?: () => void; label: string; readOnly?: boolean; className?: string;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} aria-readonly={readOnly || undefined}
      onClick={readOnly ? undefined : onToggle}
      className={cn("inline-grid size-7 shrink-0 place-items-center rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        readOnly ? "cursor-default" : "cursor-pointer hover:bg-tray", className)}>
      <span aria-hidden="true" className={cn("grid size-4 place-items-center rounded-xs border",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-line-strong bg-card", readOnly && "opacity-60")}>
        {checked === true && <Icon icon={CheckIcon} size={12} strokeWidth={2.5} />}
        {checked === "mixed" && <span className="h-0.5 w-2 rounded-full bg-current" />}
      </span>
    </button>
  );
}
