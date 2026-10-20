"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BlockedButton, ConfirmActionDialog, Panel } from "@starterkit/ui/ds";
import { buttonVariants } from "@starterkit/ui/ui/button";
import { InternetIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { api } from "@/lib/client/api";
import type { ConnectionProvider, MeDto } from "@starterkit/shared/contracts/me";
import { ME_KEY } from "./use-me";

const PROVIDERS: { id: ConnectionProvider; label: string }[] = [{ id: "google", label: "Google" }, { id: "apple", label: "Apple" }];

/**
 * Linked sign-in accounts. Connecting goes through the provider (`/api/auth/oauth/<provider>?mode=link`), which comes
 * back here with `?connected=<provider>` or `?oauth=failed`: toasted once, then dropped from the URL. Disconnecting asks first.
 */
export function ConnectionsCard({ user, providers }: { user: MeDto; providers: Record<ConnectionProvider, boolean> }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [leaving, setLeaving] = useState<ConnectionProvider | null>(null);
  const announced = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const connected = PROVIDERS.find((p) => p.id === q.get("connected"));
    const failed = q.get("oauth") === "failed";
    if (announced.current || (!connected && !failed)) return;
    announced.current = true;
    if (connected) toast(`Connected ${connected.label}.`);
    else toast.error("Couldn't connect the account. It may already be connected to another user, or the connection was canceled or took longer than 10 minutes. Try again.");
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  const label = PROVIDERS.find((p) => p.id === leaving)?.label ?? "";
  // The server refuses to remove the last way in (only_sign_in_method); say so on the button instead.
  const lastWay = !user.hasPassword && !user.isLdap && user.connected.length === 1;

  return (
    <Panel icon={InternetIcon} title="Connected accounts" description="Sign in with these accounts instead of a password">
      <ul className="grid divide-y divide-line">
        {PROVIDERS.map((p) => {
          const on = user.connected.includes(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="text-body font-medium text-fg">{p.label}</span>
              <span className="text-body-sm text-fg-3">{on ? "Connected" : "Not connected"}</span>
              {on || !providers[p.id]
                ? <BlockedButton className="ml-auto" size="sm" variant="secondary"
                    reason={on ? (lastWay ? "This is your only way to sign in. Connect another account first." : null) : `${p.label} sign-in isn't set up on this server.`}
                    onClick={() => setLeaving(p.id)}>{on ? `Disconnect ${p.label}` : `Connect ${p.label}`}</BlockedButton>
                : <a href={`/api/auth/oauth/${p.id}?mode=link`} className={buttonVariants({ variant: "secondary", size: "sm", className: "ml-auto" })}>Connect {p.label}</a>}
            </li>
          );
        })}
      </ul>
      <ConfirmActionDialog open={leaving !== null} onOpenChange={(o) => { if (!o) setLeaving(null); }} auditFields={false} reasons={[]}
        title={`Disconnect ${label}`} description={`You will no longer be able to sign in with ${label}.`}
        impact={["Your other sign-in methods keep working."]} actionLabel={`Disconnect ${label}`} destructive
        onConfirm={async () => {
          qc.setQueryData(ME_KEY, await api<MeDto>(`/api/me/connections/${leaving}`, { method: "DELETE" }));
          toast(`Disconnected ${label}.`);
        }} />
    </Panel>
  );
}
