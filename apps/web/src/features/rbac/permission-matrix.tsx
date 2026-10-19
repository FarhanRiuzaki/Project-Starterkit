import { Checkbox } from "@starterkit/ui/ds";
import { MODULES, PERMISSIONS, type PermissionName, permissionLabel } from "@/lib/shared/permissions";
import { ACTIONS, cellState, columnCells, rowCells, toggleAll, toggleCell, toggleColumn, toggleRow } from "./matrix";

const TH = "h-10 border-b border-line px-2 text-left align-middle text-label font-medium whitespace-nowrap text-fg-2";
const TD = "h-10 border-b border-line px-2 align-middle";

/**
 * Modules × actions. Header checkboxes toggle a whole row, a column or everything (mixed when some are on). Without
 * `onChange` the matrix is read-only: still focusable and readable, nothing toggles.
 */
export function PermissionMatrix({ label, value, onChange }: { label: string; value: ReadonlySet<PermissionName>; onChange?: (next: Set<PermissionName>) => void }) {
  const readOnly = !onChange;
  const set = (next: Set<PermissionName>) => onChange?.(next);
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-separate border-spacing-0 text-body">
        <thead className="bg-tray">
          <tr>
            <th scope="col" className={TH}>
              <span className="flex items-center gap-1">
                <Checkbox label="Every permission" checked={cellState(value, PERMISSIONS)} readOnly={readOnly} onToggle={() => set(toggleAll(value))} />
                Module
              </span>
            </th>
            {ACTIONS.map((a) => (
              <th key={a} scope="col" className={TH}>
                <span className="flex items-center gap-1">
                  <Checkbox label={`${permissionLabel(a)} in every module`} checked={cellState(value, columnCells(a))} readOnly={readOnly} onToggle={() => set(toggleColumn(value, a))} />
                  {permissionLabel(a)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.key}>
              <th scope="row" className={`${TD} text-left font-medium text-fg`}>
                <span className="flex items-center gap-1">
                  <Checkbox label={`Every action in ${permissionLabel(m.key)}`} checked={cellState(value, rowCells(m.key))} readOnly={readOnly} onToggle={() => set(toggleRow(value, m.key))} />
                  {permissionLabel(m.key)}
                </span>
              </th>
              {ACTIONS.map((a) => {
                const p = `${m.key}.${a}` as PermissionName;
                return (
                  <td key={a} className={TD}>
                    {m.actions.includes(a)
                      ? <Checkbox label={`${permissionLabel(a)} ${m.key}`} checked={value.has(p)} readOnly={readOnly} onToggle={() => set(toggleCell(value, p))} />
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
