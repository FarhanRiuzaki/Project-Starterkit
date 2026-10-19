"use client";

import type { ReactNode } from "react";
import { type Column, DataTable, Notice, Panel, RelativeTime } from "@starterkit/ui/ds";
import { formatNumber } from "@starterkit/ui/lib/format";
import { SessionsIcon } from "@starterkit/ui/ui/icons";
import { errorText } from "@/lib/client/api";
import { useTableQuery } from "@/lib/client/use-table-query";
import type { SessionDto } from "@/lib/shared/contracts/me";
import { SESSION_SORTS } from "@/lib/shared/paging";
import type { TableSpec } from "@/lib/shared/table-state";

type NoFilters = Record<never, string>;
const SPEC: TableSpec<NoFilters> = { sorts: SESSION_SORTS, defaultSort: "-lastSeenAt", filters: {} };

/**
 * One user's sessions as a server-paged card (your own on /me/sessions, another user's on their page): device, IP
 * address, last active; page, size and sort in the URL. `queryKey` is the first query-key part the caller invalidates
 * after ending a session; `current` labels the session making the request.
 */
export function SessionsTable({ queryKey, path, title, description, current, emptyHint, action }: {
  queryKey: string; path: `/api/${string}`; title: string; description: string; current: string;
  /** Empty state: when sessions appear. */
  emptyHint: string;
  action?: (s: SessionDto) => ReactNode;
}) {
  const t = useTableQuery<SessionDto, NoFilters>({ key: queryKey, path, spec: SPEC });
  const columns: Column<SessionDto>[] = [
    { key: "device", header: "Device", sortable: true, cell: (s) => <span className="font-medium text-fg">{s.device}{s.current && <span className="ml-2 text-caption font-normal text-primary-ink">{current}</span>}</span> },
    { key: "ip", header: "IP address", cell: (s) => <span className="font-mono text-mono">{s.ip}</span> },
    { key: "lastSeenAt", header: "Last active", sortable: true, cell: (s) => <RelativeTime at={Date.parse(s.lastSeenAt)} /> },
  ];
  return (
    <>
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the sessions; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Panel flush icon={SessionsIcon} title={title} description={description} count={t.total != null ? formatNumber(t.total) : undefined}>
        <DataTable label={title} columns={columns} rows={t.rows} rowKey={(s) => s.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging} rowActions={action}
          error={t.loadError ? { title: "Couldn't load the sessions", cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={{ icon: SessionsIcon, title: "No active sessions", description: emptyHint }} />
      </Panel>
    </>
  );
}
