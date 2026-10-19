"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmActionDialog } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { SessionsTable } from "@/components/sessions-table";
import { api } from "@/lib/client/api";
import type { SessionDto } from "@/lib/shared/contracts/me";
import { MY_SESSIONS } from "@/lib/shared/queries";

/** The signed-in user's own sessions. This one is marked; any other can be ended. */
export function MySessionsTable() {
  const qc = useQueryClient();
  const [ending, setEnding] = useState<SessionDto | null>(null);
  return (
    <>
      <SessionsTable table={MY_SESSIONS} title="My sessions" description="Where you're signed in" current="This session"
        emptyHint="Your sessions appear here after you sign in."
        action={(r) => r.current
          ? <span className="text-caption text-fg-3">Sign out from the account menu</span>
          : <Button size="sm" variant="ghost" onClick={() => setEnding(r)}>End session</Button>} />
      <ConfirmActionDialog open={ending !== null} onOpenChange={(o) => { if (!o) setEnding(null); }} auditFields={false} reasons={[]}
        title="End this session" description={ending ? `${ending.device} · ${ending.ip}` : ""}
        impact={["That device is signed out and must sign in again."]} actionLabel="End session" destructive
        onConfirm={async () => {
          await api(`/api/me/sessions/${encodeURIComponent(ending!.id)}`, { method: "DELETE" });
          await qc.invalidateQueries({ queryKey: [MY_SESSIONS.key] }); // under "me": a password change refreshes it too
        }} />
    </>
  );
}
