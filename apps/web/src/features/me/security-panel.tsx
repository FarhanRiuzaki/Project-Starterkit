"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { type FormEvent, useRef, useState } from "react";
import { BlockedButton, Failure, Field, Notice, Panel, PasswordChecks, StatusChip } from "@starterkit/ui/ds";
import { useDelayedFlag } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { KeyIcon, SecureIcon, SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { PasswordInput } from "@starterkit/ui/ui/password-input";
import { toast } from "@starterkit/ui/ui/toast";
import { LoadingShape } from "@/components/route-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { LazyConfirmActionDialog } from "@/components/lazy-confirm";
import { api, errorText } from "@/lib/client/api";
import { passwordChecks } from "@/lib/shared/password";
import { BRAND } from "@starterkit/shared/brand";
import type { ConnectionProvider, MeDto, TwoFactorSetupDto } from "@starterkit/shared/contracts/me";
import { ConnectionsCard } from "./connections-card";
import { MeNav } from "./me-nav";
import { ME_KEY, useMe } from "./use-me";
import { SECURITY_SHAPE } from "./shapes";

/** Mounted on click: the QR code generator stays out of the page's first load (start() fetches it alongside the POST). */
const loadSetup = () => import("./two-factor-setup");
const TwoFactorSetup = dynamic(() => loadSetup().then((m) => m.TwoFactorSetup), { ssr: false });
const RecoveryCodesDialog = dynamic(() => loadSetup().then((m) => m.RecoveryCodesDialog), { ssr: false });


/** No password and not a directory user: signs in only through a connected Google or Apple account. */
const providerOnly = (u: MeDto) => !u.hasPassword && !u.isLdap;

/** /me/security: password, two-factor authentication and connected accounts (`providers`: set up on the server). */
export function SecurityPage({ providers }: { providers: Record<ConnectionProvider, boolean> }) {
  const q = useMe();
  // No flash: the loading shape appears after 150 ms and then stays at least 300 ms (it holds its place hidden before).
  const skeleton = useDelayedFlag(!q.data && !q.error);
  const header = <PageHeader title="Security" description="Password, two-factor authentication and connected accounts." actions={<MeNav />} />;
  if (q.error && !q.data) return <div className="grid gap-section">{header}<Panel><Failure title="Couldn't load your security settings" error={q.error} source={BRAND.name} onRetry={() => void q.refetch()} /></Panel></div>;
  const u = q.data;
  if (!u || skeleton) return <LoadingShape sections={SECURITY_SHAPE} shown={skeleton} />;
  return (
    <div className="grid gap-section">
      {header}
      {q.error && <Notice tone="warn" live>Couldn&apos;t refresh your settings; showing the last loaded values.</Notice>}
      <div className="grid items-start gap-section md:grid-cols-2">
        <PasswordCard user={u} />
        <TwoFactorCard user={u} />
        <ConnectionsCard user={u} providers={providers} />
      </div>
    </div>
  );
}

function PasswordCard({ user }: { user: MeDto }) {
  const qc = useQueryClient();
  const currentRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checks = passwordChecks(next, again);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (next !== again) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/password", { method: "POST", body: JSON.stringify({ current, next }) });
      setCurrent(""); setNext(""); setAgain("");
      toast("Password changed. Your other sessions were signed out.");
      void qc.invalidateQueries({ queryKey: ME_KEY }); // your session list (under "me") lost the other sessions
    } catch (err) {
      setError(errorText(err));
      // The fix is almost always the current password: clear it and put the cursor there (the error is announced).
      setCurrent("");
      currentRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel icon={KeyIcon} title="Password" description="Changing it signs out your other sessions">
      {user.isLdap ? (
        <p className="text-body-sm text-fg-2">This account signs in with your directory password. Change it in your directory; it can&apos;t be changed here.</p>
      ) : !user.hasPassword ? (
        <p className="text-body-sm text-fg-2">This account signs in with a connected Google or Apple account and has no password.</p>
      ) : (
        <form onSubmit={save} className="grid gap-4">
          <Field id="pw-current" label="Current password">
            <PasswordInput ref={currentRef} id="pw-current" autoComplete="current-password" value={current} required onChange={(e) => setCurrent(e.target.value)}
              aria-invalid={error ? true : undefined} aria-errormessage={error ? "pw-error" : undefined} />
          </Field>
          <div className="grid gap-2">
            <Field id="pw-next" label="New password">
              <PasswordInput id="pw-next" autoComplete="new-password" minLength={12} value={next} required onChange={(e) => setNext(e.target.value)} aria-describedby="pw-checks" />
            </Field>
            <PasswordChecks id="pw-checks" checks={checks} />
          </div>
          <Field id="pw-again" label="Repeat new password">
            <PasswordInput id="pw-again" autoComplete="new-password" value={again} required onChange={(e) => setAgain(e.target.value)} aria-describedby="pw-checks" />
          </Field>
          {error && <p id="pw-error" role="alert" className="text-body-sm text-down-ink">{error}</p>}
          <div><Button type="submit" disabled={busy || !checks.every((c) => c.met) || !current} aria-busy={busy || undefined}>
            {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Change password</Button></div>
        </form>
      )}
    </Panel>
  );
}

const TWO_FACTOR_LEGEND = [
  { health: "healthy" as const, label: "On", description: "Signing in asks for a one-time code after the password." },
  { health: "stopped" as const, label: "Off", description: "Signing in asks for the password only." },
];

function TwoFactorCard({ user }: { user: MeDto }) {
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [setup, setSetup] = useState<TwoFactorSetupDto | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [proof, setProof] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ME_KEY });
  // Google or Apple checks these users, and their sign-in never asks for a code: nothing to turn on. One that somehow
  // has 2FA turns it off with a recovery code (no password to give).
  const oauth = providerOnly(user);
  const proofLabel = oauth ? "Recovery code" : user.isLdap ? "Directory password" : "Password";

  async function start() {
    setStarting(true);
    try {
      // The dialog's code (QR generator) downloads while the server makes the secret, not after.
      const [s] = await Promise.all([api<TwoFactorSetupDto>("/api/me/2fa", { method: "POST" }), loadSetup()]);
      setSetup(s);
    } catch (e) { toast.error(errorText(e)); }
    finally { setStarting(false); }
  }

  return (
    <Panel icon={SecureIcon} title="Two-factor authentication" description="A one-time code from an authenticator app" legend={TWO_FACTOR_LEGEND}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip health={user.twoFactorEnabled ? "healthy" : "stopped"} label={user.twoFactorEnabled ? "On" : "Off"} />
          <span className="text-body-sm text-fg-2">{user.twoFactorEnabled ? "Sign-in asks for a code after your password." : "Sign-in asks for your password only."}</span>
        </div>
        {user.connected.length > 0 && <p className="text-body-sm text-fg-3">Signing in with Google or Apple doesn&apos;t ask for the code: the provider checks you.</p>}
        <div>
          {user.twoFactorEnabled
            ? <Button variant="secondary" onClick={() => setDisabling(true)}>Turn off two-factor authentication</Button>
            : <BlockedButton onClick={() => void start()} disabled={starting} aria-busy={starting || undefined}
                reason={oauth ? "You sign in with Google or Apple, which checks you itself: sign-in never asks for a code." : null}>
              {starting && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Turn on two-factor authentication</BlockedButton>}
        </div>
      </div>
      {setup && <TwoFactorSetup setup={setup} onCancel={() => setSetup(null)} onDone={(c) => { setSetup(null); setCodes(c); toast("Two-factor authentication is on."); void refresh(); }} />}
      {codes && <RecoveryCodesDialog codes={codes} onClose={() => setCodes(null)} />}
      <LazyConfirmActionDialog open={disabling} onOpenChange={(o) => { setDisabling(o); if (!o) setProof(""); }} auditFields={false} reasons={[]}
        title="Turn off two-factor authentication" description="Sign-in will ask for your password only."
        impact={["Your recovery codes stop working."]} actionLabel="Turn off" destructive
        extra={(
          <Field id="tf-off-proof" label={proofLabel} note={oauth ? "One of the recovery codes you saved; it is used up." : undefined}>
            {oauth
              ? <Input id="tf-off-proof" autoComplete="one-time-code" value={proof} onChange={(e) => setProof(e.target.value)} />
              : <PasswordInput id="tf-off-proof" autoComplete="current-password" value={proof} onChange={(e) => setProof(e.target.value)} />}
          </Field>
        )}
        onConfirm={async () => {
          if (!proof) throw new Error(oauth ? "Enter one of your recovery codes to continue." : "Enter your password to continue.");
          await api("/api/me/2fa", { method: "DELETE", body: JSON.stringify(oauth ? { recoveryCode: proof } : { password: proof }) });
          setProof("");
          toast("Two-factor authentication is off.");
          await refresh();
        }} />
    </Panel>
  );
}
