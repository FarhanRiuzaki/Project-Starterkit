import { MODULES } from "@starterkit/shared/permissions";

type Perms = ReadonlySet<string>;
/** The rows of a matrix: module keys and their actions (the app's MODULES, or a fixed sample in the /ds gallery and tests). */
export type MatrixModules = readonly { key: string; actions: readonly string[] }[];

/** Unsaved edits of one role as add / remove against the server's current set (never a whole set). */
export type Draft = { added: string[]; removed: string[] };
export type Edit = (current: ReadonlySet<string>) => Set<string>;

/** Header checkbox state for a group: true (all), false (none or empty group), "mixed" (some). */
export function cellState(s: Perms, cells: readonly string[]): boolean | "mixed" {
  const on = cells.filter((c) => s.has(c)).length;
  return on === 0 ? false : on === cells.length ? true : "mixed";
}

/** The set the matrix shows: the saved set with the draft applied. */
export const withDraft = (saved: Perms, d: Draft | null): Set<string> =>
  new Set([...saved].filter((p) => !d?.removed.includes(p)).concat(d?.added ?? []));

/**
 * The matrix over one permission catalog: the modules' names (the app's PERMISSIONS by default) plus any added to the
 * catalog (GET /api/roles/{id} answers them as `catalog`). Rows are `modules`; columns every action any module has, the
 * modules' first (in their order), then added ones in catalog order; a module × action pair the catalog lacks is not a cell.
 */
export function matrixFor(catalog: readonly string[] = [], modules: MatrixModules = MODULES) {
  const names = [...new Set([...modules.flatMap((m) => m.actions.map((a) => `${m.key}.${a}`)), ...catalog])];
  const actionOf = (p: string) => p.slice(p.indexOf(".") + 1);
  const ACTIONS: readonly string[] = [...new Set([...modules.flatMap((m) => m.actions), ...names.map(actionOf)])];
  const rowCells = (module: string): string[] => names.filter((p) => p.startsWith(`${module}.`));
  const columnCells = (action: string): string[] => names.filter((p) => actionOf(p) === action);
  const has = (module: string, action: string) => names.includes(`${module}.${action}`);

  /**
   * Tri-state convention: a header that is fully checked clears; one that is mixed or empty fills. `allowed` (the
   * actor's own permissions) limits what changes to those cells; the decision still follows the header as shown (all
   * cells), so a mixed header never clears. Returns a new set.
   */
  function toggle(s: Perms, cells: readonly string[], allowed?: Perms): Set<string> {
    const out = new Set(s);
    const clear = cellState(s, cells) === true;
    for (const c of cells) if (!allowed || allowed.has(c)) { if (clear) out.delete(c); else out.add(c); }
    return out;
  }

  /**
   * A module's view comes with its other actions (the server's withViews): any other action on → view on; view
   * switched off (on in `before`, off in `after`) → the module's other actions go with it. With `allowed` (the actor's
   * own permissions) it only adds or removes what the actor holds, so it never grants or strips a permission they lack.
   */
  function closeViews(before: Perms, after: Perms, allowed?: Perms): Set<string> {
    const may = (p: string) => !allowed || allowed.has(p);
    const out = new Set(after);
    for (const m of modules) {
      const view = `${m.key}.view`;
      const others = rowCells(m.key).filter((p) => p !== view);
      if (!others.some((p) => out.has(p))) continue;
      if (before.has(view) && !out.has(view)) {
        for (const p of others) if (may(p)) out.delete(p);
        // An action the actor can't remove stays on, and the server keeps the view with it: so the view stays.
        if (others.some((p) => out.has(p))) out.add(view);
      } else if (may(view)) out.add(view);
    }
    return out;
  }

  /** What a save changes, in catalog order. */
  const diff = (before: Perms, after: Perms): Draft =>
    ({ added: names.filter((p) => after.has(p) && !before.has(p)), removed: names.filter((p) => before.has(p) && !after.has(p)) });

  return {
    names, ACTIONS, rowCells, columnCells, has, closeViews, diff,
    toggleCell: (s: Perms, p: string) => toggle(s, [p]),
    toggleRow: (s: Perms, module: string, allowed?: Perms) => toggle(s, rowCells(module), allowed),
    toggleColumn: (s: Perms, action: string, allowed?: Perms) => toggle(s, columnCells(action), allowed),
    toggleAll: (s: Perms, allowed?: Perms) => toggle(s, names, allowed),
    /** A module's view can't be switched off by the actor while an action they don't hold is on (closeViews keeps it). */
    viewLocked: (value: Perms, module: string, allowed?: Perms): boolean =>
      !!allowed && rowCells(module).some((p) => !p.endsWith(".view") && value.has(p) && !allowed.has(p)),
    /**
     * Apply one edit to the draft. Used as `setDraft(prev => applyEdit(saved, prev, edit))`, so toggles queued before a
     * render compose instead of each starting from the same stale set.
     */
    applyEdit: (saved: Perms, d: Draft | null, edit: Edit, allowed?: Perms): Draft => {
      const current = withDraft(saved, d);
      return diff(saved, closeViews(current, edit(current), allowed));
    },
    /** The draft against the server's current set: what it still changes (a refetch may already hold part of it). */
    rebase: (saved: Perms, d: Draft | null): Draft => diff(saved, withDraft(saved, d)),
  };
}

