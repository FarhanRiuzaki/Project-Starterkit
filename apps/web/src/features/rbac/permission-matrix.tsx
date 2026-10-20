"use client";

import { type FocusEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { Checkbox } from "@starterkit/ui/ds";
import { MODULES, PERMISSIONS, type PermissionName, permissionLabel } from "@starterkit/shared/permissions";
import { ACTIONS, cellState, columnCells, type Edit, rowCells, toggleAll, toggleCell, toggleColumn, toggleRow, viewLocked } from "./matrix";

const TH = "h-10 border-b border-line px-2 text-left align-middle text-label font-medium whitespace-nowrap text-fg-2";
const TD = "h-10 border-b border-line px-2 align-middle";
const VIEW_KEPT = "View stays on while another action in this module is on that your role doesn't hold. Ask an administrator who holds it.";
const NOT_HELD = "Your role doesn't hold this permission, so you can't grant or remove it.";

const BOX = '[role="checkbox"]';
type Pos = readonly [row: number, col: number];
/** Row and column of a checkbox in the table (header row and header column included). */
const posOf = (el: Element): Pos => {
  const cell = el.closest("th, td") as HTMLTableCellElement;
  return [(cell.parentElement as HTMLTableRowElement).rowIndex, cell.cellIndex];
};
const MOVES: Record<string, Pos> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/**
 * Keyboard: one tab stop (roving tabindex); arrow keys move between checkboxes, skipping the "–" cells; Home / End go
 * to the first / last checkbox of the row; Space or Enter toggles.
 */
function useGridKeys() {
  const ref = useRef<HTMLTableElement>(null);
  const [active, setActive] = useState<Pos>([0, 0]);
  useLayoutEffect(() => {
    const boxes = [...(ref.current?.querySelectorAll<HTMLElement>(BOX) ?? [])];
    const on = boxes.find((b) => { const [r, c] = posOf(b); return r === active[0] && c === active[1]; }) ?? boxes[0];
    for (const b of boxes) b.tabIndex = b === on ? 0 : -1;
  });
  const go = (box: HTMLElement | null | undefined, e: KeyboardEvent) => {
    if (!box) return;
    e.preventDefault();
    setActive(posOf(box));
    box.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const from = (e.target as HTMLElement).closest<HTMLElement>(BOX);
    const table = ref.current;
    if (!from || !table) return;
    const [r, c] = posOf(from);
    if (e.key === "Home" || e.key === "End") {
      const inRow = [...table.rows[r]!.querySelectorAll<HTMLElement>(BOX)];
      return go(e.key === "Home" ? inRow[0] : inRow.at(-1), e);
    }
    const d = MOVES[e.key];
    if (!d) return;
    for (let nr = r + d[0], nc = c + d[1]; table.rows[nr]?.cells[nc]; nr += d[0], nc += d[1]) {
      const box = table.rows[nr]!.cells[nc]!.querySelector<HTMLElement>(BOX);
      if (box) return go(box, e);
    }
  };
  const onFocus = (e: FocusEvent<HTMLTableElement>) => {
    const box = (e.target as HTMLElement).closest(BOX);
    if (box) setActive(posOf(box));
  };
  return { ref, onKeyDown, onFocus };
}

/**
 * Modules × actions. Header checkboxes toggle a whole row, a column or everything (mixed when some are on). Each
 * toggle reaches `onChange` as an edit of the current set (not a finished set), so fast toggles compose. Without
 * `onChange` the matrix is read-only: still focusable and readable, nothing toggles. `allowed` (the actor's own
 * permissions) mirrors the no-escalation rule: other cells are read-only with the reason, and headers skip them.
 * A grid (role="grid") with one tab stop and arrow-key movement (useGridKeys).
 */
export function PermissionMatrix({ label, value, onChange, allowed }: {
  label: string; value: ReadonlySet<PermissionName>; onChange?: (edit: Edit) => void; allowed?: ReadonlySet<PermissionName>;
}) {
  const set = (edit: Edit) => onChange?.(edit);
  const { ref: gridRef, onKeyDown, onFocus } = useGridKeys();
  /** A header is read-only when the matrix is, or when the actor may change none of its cells. */
  const fixed = (cells: readonly PermissionName[]) => !onChange || (!!allowed && !cells.some((c) => allowed.has(c)));
  const header = (cells: PermissionName[], text: string, toggle: Edit) => (
    <Checkbox label={text} checked={cellState(value, cells)} readOnly={fixed(cells)} onToggle={() => set(toggle)} />
  );
  return (
    <div className="overflow-x-auto">
      <table ref={gridRef} role="grid" aria-label={label} onKeyDown={onKeyDown} onFocus={onFocus} className="w-full border-separate border-spacing-0 text-body">
        <thead className="bg-tray">
          <tr>
            <th scope="col" className={TH}>
              <span className="flex items-center gap-1">{header([...PERMISSIONS], "Every permission", (v) => toggleAll(v, allowed))}Module</span>
            </th>
            {ACTIONS.map((a) => (
              <th key={a} scope="col" className={TH}>
                <span className="flex items-center gap-1">{header(columnCells(a), `${permissionLabel(a)} in every module`, (v) => toggleColumn(v, a, allowed))}{permissionLabel(a)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.key}>
              <th scope="row" className={`${TD} text-left font-medium text-fg`}>
                <span className="flex items-center gap-1">{header(rowCells(m.key), `Every action in ${permissionLabel(m.key)}`, (v) => toggleRow(v, m.key, allowed))}{permissionLabel(m.key)}</span>
              </th>
              {ACTIONS.map((a) => {
                const p = `${m.key}.${a}` as PermissionName;
                const held = !allowed || allowed.has(p);
                return (
                  <td key={a} className={TD}>
                    {m.actions.includes(a)
                      ? <Checkbox label={`${permissionLabel(a)} ${m.key}`} checked={value.has(p)} readOnly={!onChange} reason={onChange ? (!held ? NOT_HELD : a === "view" && viewLocked(value, m.key, allowed) ? VIEW_KEPT : undefined) : undefined}
                          onToggle={() => set((v) => toggleCell(v, p))} />
                      : <span className="inline-grid size-7 place-items-center text-fg-4"><span aria-hidden="true">–</span><span className="sr-only">No {a} permission for this module</span></span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
