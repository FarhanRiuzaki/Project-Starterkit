import { CategoryChip, type CategorySlot } from "@starterkit/ui/ds";

const SLOT: Record<string, CategorySlot> = { Superadmin: 1, Admin: 2, Viewer: 3 };

/** Role names as category chips; the same role has the same slot everywhere. `total` > roles.length adds "+N more" (a capped list). */
export function RoleChips({ roles, total = roles.length }: { roles: readonly string[]; total?: number }) {
  if (roles.length === 0) return <span className="text-fg-3">No role</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {roles.map((r) => <CategoryChip key={r} label={r} slot={SLOT[r] ?? 4} />)}
      {total > roles.length && <span className="text-caption text-fg-3">+{total - roles.length} more</span>}
    </span>
  );
}
