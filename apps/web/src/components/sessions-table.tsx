"use client";

import type { ReactNode } from "react";
import { type Column, DataTable, Notice, Panel, RelativeTime } from "@starterkit/ui/ds";
import { SessionsIcon } from "@starterkit/ui/ui/icons";
import { errorText } from "@/lib/client/api";
import { useTableQuery } from "@/lib/client/use-table-query";
import type { SessionDto } from "@starterkit/shared/contracts/me";
import type { NoFilters, TableDef } from "@/lib/shared/queries";

/**
 * One user's sessions as a server-paged card (your own on /me/sessions, another user's on their page): device, IP
 * address, last active; page, size and sort in the URL. `table` = MY_SESSIONS or userSessions(id) (lib/shared/queries);
 * its key is the prefix the caller invalidates after ending a session; `current` labels the session making the request.
 */
export function SessionsTable({ table, title, description, current, emptyHint, action }: {
  table: TableDef<NoFilters>; title: string; description: string; current: string;
  /** Empty state: when sessions appear. */
  emptyHint: string;
  action?: (s: SessionDto) => ReactNode;
}) {
  const t = useTableQuery<SessionDto, NoFilters>(table);
  const columns: Column<SessionDto>[] = [
    { key: "device", header: "Device", sortable: true, cell: (s) => <span className="font-medium text-fg">{s.device}{s.current && <span className="ml-2 text-caption font-normal text-primary-ink">{current}</span>}</span> },
    { key: "ip", header: "IP address", cell: (s) => <span className="font-mono text-mono">{s.ip}</span> },
    { key: "lastSeenAt", header: "Last active", sortable: true, cell: (s) => <RelativeTime at={Date.parse(s.lastSeenAt)} /> },
  ];
  return (
    <>
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the sessions; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Panel flush icon={SessionsIcon} title={title} description={description} count={t.count}>
        <DataTable label={title} columns={columns} rows={t.rows} rowKey={(s) => s.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging} rowActions={action}
          error={t.loadError ? { title: "Couldn't load sessions", cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={{ icon: SessionsIcon, title: "No active sessions", description: emptyHint }} />
      </Panel>
    </>
  );
}
