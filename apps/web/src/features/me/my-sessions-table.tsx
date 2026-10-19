"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ConfirmActionDialog, type Column, DataTable, Failure, Notice, Panel, RelativeTime } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { SessionsIcon } from "@starterkit/ui/ui/icons";
import { api } from "@/lib/client/api";
import type { SessionDto } from "@/lib/shared/contracts/me";

const KEY = ["me", "sessions"] as const;

/** The signed-in user's own sessions. This one is marked; any other can be ended. */
export function MySessionsTable() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => api<SessionDto[]>("/api/me/sessions") });
  const [ending, setEnding] = useState<SessionDto | null>(null);
  const columns: Column<SessionDto>[] = useMemo(() => [
    { key: "device", header: "Device", cell: (r) => <span className="font-medium text-fg">{r.device}{r.current && <span className="ml-2 text-caption font-normal text-primary-ink">This session</span>}</span> },
    { key: "ip", header: "IP address", cell: (r) => <span className="font-mono text-mono">{r.ip}</span> },
    { key: "last", header: "Last active", sortValue: (r) => r.lastSeenAt, cell: (r) => <RelativeTime at={Date.parse(r.lastSeenAt)} /> },
  ], []);
  const rows = q.data ?? [];
  return (
    <>
      {q.error && q.data && <Notice tone="warn" live>Couldn&apos;t refresh your sessions; showing the last loaded list.</Notice>}
      <Panel icon={SessionsIcon} title="My sessions" description="Where you're signed in" flush count={q.data ? rows.length : undefined}>
        {q.error && !q.data ? (
          <div className="p-4"><Failure title="Couldn't load your sessions" error={q.error} source="Starterkit" onRetry={() => void q.refetch()} /></div>
        ) : (
          <DataTable label="My sessions" columns={columns} rows={rows} rowKey={(r) => r.id} loading={q.isPending}
            rowActions={(r) => r.current
              ? <span className="text-caption text-fg-3">Sign out from the account menu</span>
              : <Button size="sm" variant="ghost" onClick={() => setEnding(r)}>End session</Button>}
            empty={{ icon: SessionsIcon, title: "No sessions", description: "Your sessions appear here after you sign in." }} />
        )}
      </Panel>
      <ConfirmActionDialog open={ending !== null} onOpenChange={(o) => { if (!o) setEnding(null); }} auditFields={false} reasons={[]}
        title="End this session" description={ending ? `${ending.device} · ${ending.ip}` : ""}
        impact={["That device is signed out and must sign in again."]} actionLabel="End session" destructive
        onConfirm={async () => {
          await api(`/api/me/sessions/${encodeURIComponent(ending!.id)}`, { method: "DELETE" });
          await qc.invalidateQueries({ queryKey: KEY });
        }} />
    </>
  );
}
