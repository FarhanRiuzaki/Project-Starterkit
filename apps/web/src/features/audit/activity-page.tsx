"use client";

import { Avatar, type Column, CopyValue, FilterMenu, Truncate } from "@starterkit/ui/ds";
import { formatDateTimeLong } from "@starterkit/ui/lib/format";
import { LogIcon } from "@starterkit/ui/ui/icons";
import { ACTION_OPTIONS, ACTIVITY_SORTS, actionLabel } from "@/lib/shared/audit";
import type { ActivityDto } from "@/lib/shared/contracts/audit";
import { oneOf, type TableSpec } from "@/lib/shared/table-state";
import { AUDIT_FILTERS, type AuditFilters, AuditTable, timeCell } from "./audit-table";
import { DiffView } from "./diff-view";

type Filters = AuditFilters & { action: string };
const ACTIONS = [{ value: "", label: "Any" }, ...ACTION_OPTIONS];
const SPEC: TableSpec<Filters> = {
  sorts: ACTIVITY_SORTS, defaultSort: "-at",
  filters: { ...AUDIT_FILTERS, action: oneOf(ACTIONS.map((a) => a.value), "") },
};

const COLUMNS: Column<ActivityDto>[] = [
  { key: "at", header: "Time", sortable: true, cell: (r) => timeCell(r.at) },
  { key: "actor", header: "User", sortable: true, className: "min-w-48", cell: (r) => (
    <span className="flex min-w-0 max-w-56 items-center gap-2.5"><Avatar name={r.actor.name} seed={r.actor.id} /><Truncate title={r.actor.name}>{r.actor.name}</Truncate></span>
  ) },
  { key: "action", header: "Action", sortable: true, cell: (r) => actionLabel(r.action) },
  { key: "target", header: "Target", cell: (r) => (
    <span className="grid max-w-64 min-w-0"><Truncate title={r.target.label}>{r.target.label}</Truncate><span className="text-caption text-fg-3">{r.target.type}</span></span>
  ) },
];

/** Activity log: who changed what, on which record, when. */
export function ActivityPage() {
  return (
    <AuditTable<ActivityDto, Filters> title="Activity log" noun="activity entries" icon={LogIcon} path="/api/audit/activity" spec={SPEC}
      description="Changes to users, roles, permissions and profiles: who made them, to which record, and when."
      columns={COLUMNS} rowLabel={(r) => `${actionLabel(r.action)}, ${r.target.label}`}
      emptyHint="Entries appear here when someone changes a user, role, permission or their own profile."
      filters={(f, set) => <FilterMenu label="Action" value={f.action} options={ACTIONS} onChange={(action) => set({ action })} />}
      detail={(r) => ({
        title: actionLabel(r.action),
        rows: [
          ["Time", formatDateTimeLong(Date.parse(r.at))],
          ["User", <span key="u">{r.actor.name} <span className="font-mono text-caption text-fg-3">{r.actor.id}</span></span>],
          ["Action", <span key="a">{actionLabel(r.action)} <span className="font-mono text-caption text-fg-3">{r.action}</span></span>],
          ["Target", <span key="t">{r.target.label} <span className="font-mono text-caption text-fg-3">{r.target.type} {r.target.id}</span></span>],
          ["Entry ID", <CopyValue key="id" value={r.id} label="entry ID" />],
        ],
        extra: <DiffView before={r.before} after={r.after} />,
      })} />
  );
}
