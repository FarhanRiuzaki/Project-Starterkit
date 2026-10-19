import { Checkbox } from "@starterkit/ui/ds";
import { MODULES, PERMISSIONS, type PermissionName, permissionLabel } from "@/lib/shared/permissions";
import { ACTIONS, cellState, columnCells, rowCells, toggleAll, toggleCell, toggleColumn, toggleRow } from "./matrix";

const TH = "h-10 border-b border-line px-2 text-left align-middle text-label font-medium whitespace-nowrap text-fg-2";
const TD = "h-10 border-b border-line px-2 align-middle";
const NOT_HELD = "Your role doesn't hold this permission, so you can't grant or remove it.";

/**
 * Modules × actions. Header checkboxes toggle a whole row, a column or everything (mixed when some are on). Without
 * `onChange` the matrix is read-only: still focusable and readable, nothing toggles. `allowed` (the actor's own
 * permissions) mirrors the no-escalation rule: other cells are read-only with the reason, and headers skip them.
 */
export function PermissionMatrix({ label, value, onChange, allowed }: {
  label: string; value: ReadonlySet<PermissionName>; onChange?: (next: Set<PermissionName>) => void; allowed?: ReadonlySet<PermissionName>;
}) {
  const set = (next: Set<PermissionName>) => onChange?.(next);
  /** A header is read-only when the matrix is, or when the actor may change none of its cells. */
  const fixed = (cells: readonly PermissionName[]) => !onChange || (!!allowed && !cells.some((c) => allowed.has(c)));
  const header = (cells: PermissionName[], text: string, toggle: () => Set<PermissionName>) => (
    <Checkbox label={text} checked={cellState(value, cells)} readOnly={fixed(cells)} onToggle={() => set(toggle())} />
  );
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-separate border-spacing-0 text-body">
        <thead className="bg-tray">
          <tr>
            <th scope="col" className={TH}>
              <span className="flex items-center gap-1">{header([...PERMISSIONS], "Every permission", () => toggleAll(value, allowed))}Module</span>
            </th>
            {ACTIONS.map((a) => (
              <th key={a} scope="col" className={TH}>
                <span className="flex items-center gap-1">{header(columnCells(a), `${permissionLabel(a)} in every module`, () => toggleColumn(value, a, allowed))}{permissionLabel(a)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.key}>
              <th scope="row" className={`${TD} text-left font-medium text-fg`}>
                <span className="flex items-center gap-1">{header(rowCells(m.key), `Every action in ${permissionLabel(m.key)}`, () => toggleRow(value, m.key, allowed))}{permissionLabel(m.key)}</span>
              </th>
              {ACTIONS.map((a) => {
                const p = `${m.key}.${a}` as PermissionName;
                const held = !allowed || allowed.has(p);
                return (
                  <td key={a} className={TD}>
                    {m.actions.includes(a)
                      ? <Checkbox label={`${permissionLabel(a)} ${m.key}`} checked={value.has(p)} readOnly={!onChange} reason={onChange && !held ? NOT_HELD : undefined}
                          onToggle={() => set(toggleCell(value, p))} />
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
