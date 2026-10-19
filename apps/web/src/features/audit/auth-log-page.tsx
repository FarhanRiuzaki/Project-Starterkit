"use client";

import { type Column, CopyValue, FilterMenu, StatusChip, Truncate } from "@starterkit/ui/ds";
import { formatDateTimeLong } from "@starterkit/ui/lib/format";
import type { Health } from "@starterkit/ui/lib/status";
import { SessionsIcon } from "@starterkit/ui/ui/icons";
import { AUTH_EVENTS, AUTH_METHODS, EVENT_LABEL, METHOD_LABEL } from "@/lib/shared/audit";
import type { AuthLogDto } from "@/lib/shared/contracts/audit";
import { AUTH_LOG, type AuthLogFilters } from "@/lib/shared/queries";
import { AuditTable, timeCell } from "./audit-table";

type Event = AuthLogDto["event"];
const EVENTS = [{ value: "" as const, label: "Any" }, ...AUTH_EVENTS.map((e) => ({ value: e, label: EVENT_LABEL[e] }))];
const METHODS = [{ value: "" as const, label: "Any" }, ...AUTH_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))];

const HEALTH: Record<Event, Health> = { login_success: "healthy", "2fa_success": "healthy", login_failed: "down", "2fa_failed": "down", logout: "stopped" };
const LEGEND = [
  { health: "healthy" as const, label: "Signed in, code accepted", description: "The sign-in step passed." },
  { health: "down" as const, label: "Sign-in failed, code rejected", description: "Wrong credentials or one-time code, or the account can't sign in." },
  { health: "stopped" as const, label: "Signed out", description: "The session ended." },
];
const EventChip = ({ event }: { event: Event }) => <StatusChip health={HEALTH[event]} label={EVENT_LABEL[event]} />;

const COLUMNS: Column<AuthLogDto>[] = [
  { key: "at", header: "Time", sortable: true, cell: (r) => timeCell(r.at) },
  { key: "login", header: "User", sortable: true, className: "min-w-48", cell: (r) => (
    <span className="grid max-w-64 min-w-0"><Truncate title={r.login}>{r.login}</Truncate>{!r.userId && <span className="text-caption text-fg-3">No matching user</span>}</span>
  ) },
  { key: "event", header: "Event", sortable: true, cell: (r) => <EventChip event={r.event} /> },
  { key: "method", header: "Method", cell: (r) => METHOD_LABEL[r.method] },
  { key: "ip", header: "IP", cell: (r) => <span className="font-mono">{r.ip}</span> },
  { key: "device", header: "Device", cell: (r) => <span className="block max-w-48"><Truncate title={r.device}>{r.device}</Truncate></span> },
  { key: "location", header: "Location", cell: (r) => r.location ?? "–" },
];

/** Sign-in log: sign-ins, failed attempts, one-time codes and sign-outs, with method, IP, device and location. */
export function AuthLogPage() {
  return (
    <AuditTable<AuthLogDto, AuthLogFilters> title="Sign-in log" noun="sign-in entries" icon={SessionsIcon} table={AUTH_LOG}
      description="Sign-ins, failed attempts, one-time codes and sign-outs, with the method, IP address and device."
      columns={COLUMNS} rowLabel={(r) => `${EVENT_LABEL[r.event]}, ${r.login}`} legend={LEGEND}
      emptyHint="Entries appear here each time someone signs in, enters a one-time code or signs out."
      filters={(f, set) => <>
        <FilterMenu label="Event" value={f.event} options={EVENTS} onChange={(event) => set({ event })} />
        <FilterMenu label="Method" value={f.method} options={METHODS} onChange={(method) => set({ method })} />
      </>}
      detail={(r) => ({
        title: EVENT_LABEL[r.event],
        rows: [
          ["Time", formatDateTimeLong(Date.parse(r.at))],
          ["Sign-in name", r.login],
          ["User ID", r.userId ? <span key="u" className="font-mono">{r.userId}</span> : "No matching user"],
          ["Event", <EventChip key="e" event={r.event} />],
          ["Method", METHOD_LABEL[r.method]],
          ["IP address", <span key="ip" className="font-mono">{r.ip}</span>],
          ["Device", r.device],
          ["Location", r.location ?? "–"],
          ["Entry ID", <CopyValue key="id" value={r.id} label="entry ID" />],
        ],
      })} />
  );
}
