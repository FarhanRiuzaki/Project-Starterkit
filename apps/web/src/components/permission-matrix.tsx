"use client";

import { type FocusEvent, type KeyboardEvent, type MouseEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@starterkit/ui/ds";
import { MODULES, permissionLabel } from "@starterkit/shared/permissions";
import { cellState, type Edit, matrixFor } from "@/lib/shared/matrix";

/**
 * Header row and module column stay in view while the matrix scrolls inside its card (sticky on their own fill,
 * the same colours as before, so nothing changes where it fits; on a phone a rule marks the column edge). 44 px rows
 * under a coarse pointer.
 */
const TH = "sticky top-0 z-10 h-10 border-b border-line bg-tray px-2 text-left align-middle text-label font-medium whitespace-nowrap text-fg-2 pointer-coarse:h-11";
const CORNER = "left-0 z-20 max-md:border-r";
const ROW_HEAD = "sticky left-0 z-1 bg-card max-md:border-r";
const TD = "h-10 border-b border-line px-2 align-middle pointer-coarse:h-11";
const VIEW_KEPT = "This role has another action in this module that your role doesn't hold, so View stays on. Ask an administrator who holds it.";
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
 * A grid (role="grid") with one tab stop and arrow-key movement (useGridKeys). `catalog`: every name a role can hold
 * (the app's and any added to the catalog; default the app's), so an added action gets its column.
 */
export function PermissionMatrix({ label, value, onChange, allowed, catalog }: {
  label: string; value: ReadonlySet<string>; onChange?: (edit: Edit) => void; allowed?: ReadonlySet<string>; catalog?: readonly string[];
}) {
  const mx = useMemo(() => matrixFor(catalog), [catalog]);
  // Touch path for a read-only cell's reason (its tooltip needs hover): a press shows it under the matrix; any change
  // to the set (a press on a cell that toggles) clears it.
  const [note, setNote] = useState("");
  const set = (edit: Edit) => { setNote(""); onChange?.(edit); };
  const { ref: gridRef, onKeyDown, onFocus } = useGridKeys();
  const onClick = (e: MouseEvent<HTMLTableElement>) => {
    const box = (e.target as HTMLElement).closest<HTMLElement>(`${BOX}[aria-describedby]`);
    const reason = box && document.getElementById(box.getAttribute("aria-describedby")!)?.textContent;
    if (box && reason) setNote(`${box.getAttribute("aria-label")}: ${reason}`);
  };
  /** A header is read-only when the matrix is, or when the actor may change none of its cells. */
  const fixed = (cells: readonly string[]) => !onChange || (!!allowed && !cells.some((c) => allowed.has(c)));
  const header = (cells: string[], text: string, toggle: Edit) => (
    <Checkbox label={text} checked={cellState(value, cells)} readOnly={fixed(cells)} onToggle={() => set(toggle)} />
  );
  return (
    <>
    {/* Scrolls inside its card when wider (or taller) than the screen; `relative` keeps the sr-only reasons of read-only
        checkboxes (absolutely positioned) inside the scroll box instead of widening the page. */}
    <div className="relative max-h-[70dvh] overflow-auto overscroll-x-contain">
      <table ref={gridRef} role="grid" aria-label={label} onKeyDown={onKeyDown} onFocus={onFocus} onClick={onClick} className="w-full border-separate border-spacing-0 text-body">
        <thead className="bg-tray">
          <tr>
            <th scope="col" className={`${TH} ${CORNER}`}>
              <span className="flex items-center gap-1">{header([...mx.names], "Every permission", (v) => mx.toggleAll(v, allowed))}Module</span>
            </th>
            {mx.ACTIONS.map((a) => (
              <th key={a} scope="col" className={TH}>
                <span className="flex items-center gap-1">{header(mx.columnCells(a), `${permissionLabel(a)} in every module`, (v) => mx.toggleColumn(v, a, allowed))}{permissionLabel(a)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.key}>
              <th scope="row" className={`${TD} ${ROW_HEAD} text-left font-medium text-fg`}>
                <span className="flex items-center gap-1">{header(mx.rowCells(m.key), `Every action in ${permissionLabel(m.key)}`, (v) => mx.toggleRow(v, m.key, allowed))}{permissionLabel(m.key)}</span>
              </th>
              {mx.ACTIONS.map((a) => {
                const p = `${m.key}.${a}`;
                const held = !allowed || allowed.has(p);
                return (
                  <td key={a} className={TD}>
                    {mx.has(m.key, a)
                      ? <Checkbox label={`${permissionLabel(a)} ${m.key}`} checked={value.has(p)} readOnly={!onChange} reason={onChange ? (!held ? NOT_HELD : a === "view" && mx.viewLocked(value, m.key, allowed) ? VIEW_KEPT : undefined) : undefined}
                          onToggle={() => set((v) => mx.toggleCell(v, p))} />
                      : <span className="inline-grid size-7 place-items-center text-fg-4"><span aria-hidden="true">–</span><span className="sr-only">No {a} permission for this module</span></span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p role="status" className={note ? "border-t border-line px-3 py-2 text-caption text-fg-2" : undefined}>{note}</p>
    </>
  );
}
