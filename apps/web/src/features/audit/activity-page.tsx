"use client";

import { useSearchParams } from "next/navigation";
import { Avatar, type Column, FilterChecks, Truncate } from "@starterkit/ui/ds";
import { LogIcon } from "@starterkit/ui/ui/icons";
import { actionLabel } from "@starterkit/shared/audit";
import { validActivityExactFilters } from "@starterkit/shared/audit-investigation";
import type { ActivityDto } from "@starterkit/shared/contracts/audit";
import { ACTIONS, ACTIVITY, type ActivityFilters, type TableDef } from "@/lib/shared/queries";
import { writeTableFromSearch } from "@/lib/shared/raw-table-state";
import { AuditTable, timeCell } from "./audit-table";
import { useActivityEntry } from "./use-activity-entry";
import { ActivityEntryLoader } from "./activity-entry-loader";
import { EXACT_FILTER_FIELDS, exactFilterClearPatch, exactFilterSummary } from "./activity-filter-state";

const ACTIVITY_TABLE: TableDef<ActivityFilters> = { ...ACTIVITY, edit: (source, patch) => writeTableFromSearch(source, patch, ACTIVITY.spec, ACTIVITY.rawFilters!) };

/** Phone card: the action is the title, then user, target and time. */
const COLUMNS: Column<ActivityDto>[] = [
  { key: "at", header: "Time", sortable: true, cell: (r) => timeCell(r.at) },
  { key: "actor", header: "User", sortable: true, className: "min-w-48", cell: (r) => (
    <span className="flex min-w-0 max-w-56 items-center gap-2.5"><Avatar name={r.actor.name} seed={r.actor.id} /><Truncate title={r.actor.name}>{r.actor.name}</Truncate></span>
  ) },
  { key: "action", header: "Action", sortable: true, mobile: "title", cell: (r) => actionLabel(r.action) },
  { key: "target", header: "Target", cell: (r) => (
    <span className="grid max-w-64 min-w-0"><Truncate title={r.target.label}>{r.target.label}</Truncate><span className="text-caption text-fg-3">{r.target.type}</span></span>
  ) },
];

/** Activity log: who changed what, on which record, when. */
export function ActivityPage() {
  const entry = useActivityEntry();
  const search = useSearchParams();
  return (<ActivityEntryLoader entry={entry}>{(entryNotice, pendingEntry) =>
    <AuditTable<ActivityDto, ActivityFilters> title="Activity log" noun="activity entries" icon={LogIcon} table={ACTIVITY_TABLE}
      description="Changes to users, roles, permissions, profiles and projects: who made them, to which record, and when."
      columns={COLUMNS} rowLabel={(r) => `${actionLabel(r.action)}, ${r.target.label}`}
      emptyHint="Entries appear here when someone changes a user, role, permission, profile or project."
      filterFields={[{ key: "action", label: "Action", multiple: true, format: actionLabel }]}
      filters={(f, set) => <FilterChecks label="Action" value={f.action} options={ACTIONS} onChange={(action) => set({ action })} />}
      exactFilters={{ values: exactFilterSummary(search), fields: EXACT_FILTER_FIELDS, clearPatch: exactFilterClearPatch, valid: validActivityExactFilters(search) }}
      entryNotice={entryNotice} pendingEntry={pendingEntry} onEntry={(row, trigger) => entry.open(row.id, trigger)} />
    }</ActivityEntryLoader>
  );
}
