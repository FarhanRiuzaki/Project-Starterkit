import { cn } from "../lib/cn";
import { Icon } from "../ui/icon";
import { CheckIcon } from "../ui/icons";

/**
 * New-password requirements under the field, visible before the first keystroke and ticked off while the user types
 * (NN/g password creation): a met one turns fg with a tick, an open one stays fg-3 with an empty ring (neutral ink:
 * status colours are for health only). Put `id` in the field's aria-describedby; no live region, so a screen reader
 * isn't read a list on every keystroke. Each item says "done" / "not yet" to it.
 */
export function PasswordChecks({ id, checks }: { id: string; checks: { label: string; met: boolean }[] }) {
  return (
    <ul id={id} className="grid gap-1 text-caption">
      {checks.map((c, i) => (
        <li key={i} className={cn("flex items-center gap-1.5", c.met ? "text-fg" : "text-fg-3")}>
          {c.met ? <Icon icon={CheckIcon} className="size-3.5 shrink-0" /> : <span aria-hidden="true" className="mx-0.5 size-2.5 shrink-0 rounded-full border border-line-strong" />}
          {c.label}<span className="sr-only">{c.met ? ", done" : ", not yet"}</span>
        </li>
      ))}
    </ul>
  );
}
