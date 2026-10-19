"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmActionDialog, Panel } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { InternetIcon } from "@starterkit/ui/ui/icons";
import { api, errorText } from "@/lib/client/api";
import type { ConnectionProvider, MeDto } from "@/lib/shared/contracts/me";
import { ME_KEY } from "./use-me";

const PROVIDERS: { id: ConnectionProvider; label: string }[] = [{ id: "google", label: "Google" }, { id: "apple", label: "Apple" }];

/** Linked sign-in accounts (mock: no provider round trip). Disconnecting asks first. */
export function ConnectionsCard({ user }: { user: MeDto }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<ConnectionProvider | null>(null);
  const [leaving, setLeaving] = useState<ConnectionProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(p: ConnectionProvider, method: "POST" | "DELETE") {
    const u = await api<MeDto>(`/api/me/connections/${p}`, { method });
    qc.setQueryData(ME_KEY, u);
  }
  async function connect(p: ConnectionProvider) {
    setBusy(p);
    setError(null);
    try { await run(p, "POST"); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(null); }
  }
  const label = PROVIDERS.find((p) => p.id === leaving)?.label ?? "";

  return (
    <Panel icon={InternetIcon} title="Connected accounts" description="Sign in with these accounts instead of a password">
      <ul className="grid divide-y divide-line">
        {PROVIDERS.map((p) => {
          const on = user.connected.includes(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="text-body font-medium text-fg">{p.label}</span>
              <span className="text-body-sm text-fg-3">{on ? "Connected" : "Not connected"}</span>
              <Button className="ml-auto" size="sm" variant="secondary" disabled={busy === p.id}
                onClick={() => (on ? setLeaving(p.id) : void connect(p.id))}>{on ? `Disconnect ${p.label}` : `Connect ${p.label}`}</Button>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-3 text-body-sm text-down-ink">{error}</p>}
      <ConfirmActionDialog open={leaving !== null} onOpenChange={(o) => { if (!o) setLeaving(null); }} auditFields={false} reasons={[]}
        title={`Disconnect ${label}`} description={`You will no longer be able to sign in with ${label}.`}
        impact={["Your other sign-in methods keep working."]} actionLabel={`Disconnect ${label}`} destructive
        onConfirm={async () => { await run(leaving!, "DELETE"); }} />
    </Panel>
  );
}
