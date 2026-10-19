import { type Action, MODULES, PERMISSIONS, type PermissionName } from "@/lib/shared/permissions";

type Module = (typeof MODULES)[number]["key"];
type Perms = ReadonlySet<PermissionName>;

/** Matrix columns: every action of any module, in MODULES order. */
export const ACTIONS: readonly Action[] = [...new Set(MODULES.flatMap((m) => m.actions))];

/** The cells of one row / column; a module × action pair the catalog lacks (audit.create) is not a cell. */
export const rowCells = (module: Module): PermissionName[] => PERMISSIONS.filter((p) => p.startsWith(`${module}.`));
export const columnCells = (action: Action): PermissionName[] => PERMISSIONS.filter((p) => p.endsWith(`.${action}`));

/**
 * Tri-state convention: a header that is fully checked clears; one that is mixed or empty fills. `allowed` (the actor's
 * own permissions) limits what changes to those cells; the decision still follows the header as shown (all cells),
 * so a mixed header never clears. Returns a new set.
 */
function toggle(s: Perms, cells: readonly PermissionName[], allowed?: Perms): Set<PermissionName> {
  const out = new Set(s);
  const clear = cellState(s, cells) === true;
  for (const c of cells) if (!allowed || allowed.has(c)) { if (clear) out.delete(c); else out.add(c); }
  return out;
}

export const toggleCell = (s: Perms, p: PermissionName) => toggle(s, [p]);
export const toggleRow = (s: Perms, module: Module, allowed?: Perms) => toggle(s, rowCells(module), allowed);
export const toggleColumn = (s: Perms, action: Action, allowed?: Perms) => toggle(s, columnCells(action), allowed);
export const toggleAll = (s: Perms, allowed?: Perms) => toggle(s, PERMISSIONS, allowed);

/**
 * A module's view comes with its other actions (the server's withViews): any other action on → view on; view
 * switched off (on in `before`, off in `after`) → the module's other actions go with it.
 */
export function closeViews(before: Perms, after: Perms): Set<PermissionName> {
  const out = new Set(after);
  for (const m of MODULES) {
    const view = `${m.key}.view` as PermissionName;
    const others = rowCells(m.key).filter((p) => p !== view);
    if (!others.some((p) => out.has(p))) continue;
    if (before.has(view) && !out.has(view)) for (const p of others) out.delete(p);
    else out.add(view);
  }
  return out;
}

/** Header checkbox state for a group: true (all), false (none or empty group), "mixed" (some). */
export function cellState(s: Perms, cells: readonly PermissionName[]): boolean | "mixed" {
  const on = cells.filter((c) => s.has(c)).length;
  return on === 0 ? false : on === cells.length ? true : "mixed";
}

/** What a save changes, in catalog order. */
export function diff(before: Perms, after: Perms): { added: PermissionName[]; removed: PermissionName[] } {
  return { added: PERMISSIONS.filter((p) => after.has(p) && !before.has(p)), removed: PERMISSIONS.filter((p) => before.has(p) && !after.has(p)) };
}

/** Unsaved edits of one role as add / remove against the server's current set (never a whole set). */
export type Draft = ReturnType<typeof diff>;
export type Edit = (current: ReadonlySet<PermissionName>) => Set<PermissionName>;

/** The set the matrix shows: the saved set with the draft applied. */
export const withDraft = (saved: Perms, d: Draft | null): Set<PermissionName> =>
  new Set([...saved].filter((p) => !d?.removed.includes(p)).concat(d?.added ?? []));

/**
 * Apply one edit to the draft. Used as `setDraft(prev => applyEdit(saved, prev, edit))`, so toggles queued before a
 * render compose instead of each starting from the same stale set.
 */
export const applyEdit = (saved: Perms, d: Draft | null, edit: Edit): Draft => {
  const current = withDraft(saved, d);
  return diff(saved, closeViews(current, edit(current)));
};

/** The draft against the server's current set: what it still changes (a refetch may already hold part of it). */
export const rebase = (saved: Perms, d: Draft | null): Draft => diff(saved, withDraft(saved, d));
