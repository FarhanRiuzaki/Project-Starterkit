import { cn } from "../lib/cn";
import { avatarSlot, initials } from "../lib/avatar";

const TINT = { 1: "bg-chart-1/15", 2: "bg-chart-2/15", 3: "bg-chart-3/15", 4: "bg-chart-4/15", 5: "bg-chart-5/15", 6: "bg-chart-6/15" } as const;
const SIZE = { 24: "size-6 text-label", 28: "size-7 text-label", 32: "size-8 text-label" } as const;

/**
 * Initials avatar (spec §5.11): no photos. 28 px in tables, 24 px in chips, 32 px for the account. 600-weight
 * initials in --fg on a tint picked by hash from the six categorical slots, 1 px line ring. Decorative
 * (aria-hidden): the name is always next to it. Initials are `label` (12 px) at weight 600 for every size. `AvatarStack` overlaps −6 px with a 2 px surface ring.
 * `seed` = the stable username: it picks the tint, so one developer has the same colour on every page whatever
 * display name a source sends; the initials always come from `name`.
 */
export function Avatar({ name, seed, size = 28, className }: { name: string; seed?: string; size?: 24 | 28 | 32; className?: string }) {
  return (
    <span aria-hidden="true" data-slot="avatar"
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-fg ring-1 ring-line", SIZE[size], TINT[avatarSlot(seed || name)], className)}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, seeds, size = 24, max = 4 }: { names: string[]; seeds?: string[]; size?: 24 | 28 | 32; max?: number }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span role="img" aria-label={names.join(", ")} className="inline-flex items-center">
      {shown.map((n, i) => <Avatar key={`${n}-${i}`} name={n} seed={seeds?.[i]} size={size} className={cn("ring-2 ring-card", i > 0 && "-ml-1.5")} />)}
      {rest > 0 && <span aria-hidden="true" className={cn("-ml-1.5 inline-grid place-items-center rounded-full bg-tray text-caption text-fg-2 ring-2 ring-card", SIZE[size])}>+{rest}</span>}
    </span>
  );
}
