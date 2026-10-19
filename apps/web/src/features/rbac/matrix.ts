import { type Action, MODULES, PERMISSIONS, type PermissionName } from "@/lib/shared/permissions";

type Module = (typeof MODULES)[number]["key"];
type Perms = ReadonlySet<PermissionName>;

/** Matrix columns: every action of any module, in MODULES order. */
export const ACTIONS: readonly Action[] = [...new Set(MODULES.flatMap((m) => m.actions))];

/** The cells of one row / column; a module × action pair the catalog lacks (audit.create) is not a cell. */
export const rowCells = (module: Module): PermissionName[] => PERMISSIONS.filter((p) => p.startsWith(`${module}.`));
export const columnCells = (action: Action): PermissionName[] => PERMISSIONS.filter((p) => p.endsWith(`.${action}`));

/** All target cells on → clear them; otherwise → turn them all on. Returns a new set. */
function toggle(s: Perms, cells: readonly PermissionName[]): Set<PermissionName> {
  const out = new Set(s);
  const allOn = cells.length > 0 && cells.every((c) => s.has(c));
  for (const c of cells) if (allOn) out.delete(c); else out.add(c);
  return out;
}

/** `allowed` (the actor's own permissions): header toggles change only those cells, the rest keep their state. */
const only = (cells: readonly PermissionName[], allowed?: Perms) => (allowed ? cells.filter((c) => allowed.has(c)) : cells);

export const toggleCell = (s: Perms, p: PermissionName) => toggle(s, [p]);
export const toggleRow = (s: Perms, module: Module, allowed?: Perms) => toggle(s, only(rowCells(module), allowed));
export const toggleColumn = (s: Perms, action: Action, allowed?: Perms) => toggle(s, only(columnCells(action), allowed));
export const toggleAll = (s: Perms, allowed?: Perms) => toggle(s, only(PERMISSIONS, allowed));

/** Header checkbox state for a group: true (all), false (none or empty group), "mixed" (some). */
export function cellState(s: Perms, cells: readonly PermissionName[]): boolean | "mixed" {
  const on = cells.filter((c) => s.has(c)).length;
  return on === 0 ? false : on === cells.length ? true : "mixed";
}

/** What a save changes, in catalog order. */
export function diff(before: Perms, after: Perms): { added: PermissionName[]; removed: PermissionName[] } {
  return { added: PERMISSIONS.filter((p) => after.has(p) && !before.has(p)), removed: PERMISSIONS.filter((p) => before.has(p) && !after.has(p)) };
}
