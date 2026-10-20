"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BlockedButton, Panel } from "@starterkit/ui/ds";
import { Button, buttonVariants } from "@starterkit/ui/ui/button";
import { InternetIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { LazyConfirmActionDialog } from "@/components/lazy-confirm";
import { api } from "@/lib/client/api";
import type { ConnectionProvider, MeDto } from "@starterkit/shared/contracts/me";
import { ME_KEY } from "./use-me";

const PROVIDERS: { id: ConnectionProvider; label: string }[] = [{ id: "google", label: "Google" }, { id: "apple", label: "Apple" }];

/** Mounted on click: the password step before a connection stays out of the page's first load. */
const ReauthDialog = dynamic(() => import("./reauth-dialog").then((m) => m.ReauthDialog), { ssr: false });

/**
 * Linked sign-in accounts. Connecting goes through the provider (`/api/auth/oauth/<provider>?mode=link`), which comes
 * back here with `?connected=<provider>` or `?oauth=failed`: toasted once, then dropped from the URL. A connection adds
 * a way to sign in, so the session must have proved the user within 10 minutes (`reauthFresh`): otherwise Connect asks
 * for the password (or a recovery code) first; an account with neither signs in again. A start the API still refuses
 * for that comes back with `?oauth=reauth`. Disconnecting asks first.
 */
export function ConnectionsCard({ user, providers }: { user: MeDto; providers: Record<ConnectionProvider, boolean> }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [leaving, setLeaving] = useState<ConnectionProvider | null>(null);
  const [confirming, setConfirming] = useState<ConnectionProvider | null>(null);
  const announced = useRef(false);
  const usesCode = !user.hasPassword && !user.isLdap;
  // A password (directory password for LDAP) or, without one, a recovery code proves the user; else only a new sign-in.
  const noProof = usesCode && !user.twoFactorEnabled ? "Sign in again to connect another account." : null;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const connected = PROVIDERS.find((p) => p.id === q.get("connected"));
    const failed = q.get("oauth") === "failed";
    const reauth = q.get("oauth") === "reauth";
    if (announced.current || (!connected && !failed && !reauth)) return;
    announced.current = true;
    if (connected) toast(`Connected ${connected.label}.`);
    else if (reauth) toast.error(noProof ?? (usesCode ? "Confirm with a recovery code to connect another account." : "Confirm your password to connect another account."));
    else toast.error("Couldn't connect the account. It may already be connected to another user, or the connection was canceled or took longer than 10 minutes. Try again.");
    router.replace(window.location.pathname, { scroll: false });
  }, [router, noProof, usesCode]);

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
                ? <BlockedButton className="ml-auto" wrapClassName="ml-auto items-end" size="sm" variant="secondary"
                    reason={on ? (lastWay ? "This is your only way to sign in. Connect another account first." : null) : `${p.label} sign-in isn't set up on this server.`}
                    onClick={() => setLeaving(p.id)}>{on ? `Disconnect ${p.label}` : `Connect ${p.label}`}</BlockedButton>
                : user.reauthFresh
                  ? <a href={`/api/auth/oauth/${p.id}?mode=link`} className={buttonVariants({ variant: "secondary", size: "sm", className: "ml-auto" })}>Connect {p.label}</a>
                  : noProof
                    ? <BlockedButton className="ml-auto" wrapClassName="ml-auto items-end" size="sm" variant="secondary" reason={noProof}>Connect {p.label}</BlockedButton>
                    : <Button className="ml-auto" size="sm" variant="secondary" onClick={() => setConfirming(p.id)}>Connect {p.label}</Button>}
            </li>
          );
        })}
      </ul>
      {confirming && (
        <ReauthDialog user={user} provider={confirming} label={PROVIDERS.find((p) => p.id === confirming)!.label} onCancel={() => setConfirming(null)} />
      )}
      <LazyConfirmActionDialog open={leaving !== null} onOpenChange={(o) => { if (!o) setLeaving(null); }} auditFields={false} reasons={[]}
        title={`Disconnect ${label}`} description={`You will no longer be able to sign in with ${label}.`}
        impact={["Your other sign-in methods keep working."]} actionLabel={`Disconnect ${label}`} destructive
        onConfirm={async () => {
          qc.setQueryData(ME_KEY, await api<MeDto>(`/api/me/connections/${leaving}`, { method: "DELETE" }));
          toast(`Disconnected ${label}.`);
        }} />
    </Panel>
  );
}
