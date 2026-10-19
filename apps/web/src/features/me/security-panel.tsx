"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { ConfirmActionDialog, Failure, Notice, Panel, SecretOnceDialog, StatusChip } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { KeyIcon, SecureIcon, SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { api, errorText } from "@/lib/client/api";
import type { TwoFactorSetupDto } from "@/lib/shared/contracts/me";
import type { UserDto } from "@/lib/shared/contracts/users";
import { ConnectionsCard } from "./connections-card";
import { TwoFactorSetup } from "./two-factor-setup";
import { ME_KEY, useMe } from "./use-me";


/** Password, two-factor authentication and connected accounts of the signed-in user. */
export function SecurityPanel() {
  const q = useMe();
  if (q.error && !q.data) return <Panel><Failure title="Couldn't load your security settings" error={q.error} source="Starterkit" onRetry={() => void q.refetch()} /></Panel>;
  const u = q.data;
  return (
    <div className="grid items-start gap-section lg:grid-cols-2">
      {q.error && <div className="lg:col-span-2"><Notice tone="warn" live>Couldn&apos;t refresh your settings; showing the last loaded values.</Notice></div>}
      {u ? <PasswordCard user={u} /> : <Loading title="Password" />}
      {u ? <TwoFactorCard user={u} /> : <Loading title="Two-factor authentication" />}
      {u ? <ConnectionsCard user={u} /> : <Loading title="Connected accounts" />}
    </div>
  );
}

function Loading({ title }: { title: string }) {
  return <Panel title={title}><div className="grid gap-3" aria-busy="true"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-2/3" /></div></Panel>;
}

function PasswordCard({ user }: { user: UserDto }) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const mismatch = again !== "" && again !== next;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (next !== again) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/me/password", { method: "POST", body: JSON.stringify({ current, next }) });
      setCurrent(""); setNext(""); setAgain("");
      setMsg({ ok: true, text: "Password changed. Your other sessions were signed out." });
      void qc.invalidateQueries({ queryKey: ME_KEY }); // your session list (under "me") lost the other sessions
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel icon={KeyIcon} title="Password" description="Changing it signs out your other sessions">
      {user.isLdap ? (
        <p className="text-body-sm text-fg-2">This account signs in with your directory password. Change it in your directory; it can&apos;t be changed here.</p>
      ) : (
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="pw-current" className="text-label text-fg">Current password</label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} required onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="pw-next" className="text-label text-fg">New password</label>
            <Input id="pw-next" type="password" autoComplete="new-password" minLength={12} value={next} required onChange={(e) => setNext(e.target.value)} aria-describedby="pw-next-note" />
            <span id="pw-next-note" className="text-caption text-fg-3">At least 12 characters.</span>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="pw-again" className="text-label text-fg">Repeat new password</label>
            <Input id="pw-again" type="password" autoComplete="new-password" value={again} required onChange={(e) => setAgain(e.target.value)}
              aria-invalid={mismatch || undefined} aria-describedby={mismatch ? "pw-again-err" : undefined} />
            {mismatch && <span id="pw-again-err" className="text-body-sm text-down-ink">The passwords don&apos;t match. Enter the same new password twice.</span>}
          </div>
          {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-body-sm text-healthy-ink" : "text-body-sm text-down-ink"}>{msg.text}</p>}
          <div><Button type="submit" disabled={busy || next.length < 12 || next !== again || !current}>
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

function TwoFactorCard({ user }: { user: UserDto }) {
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [setup, setSetup] = useState<TwoFactorSetupDto | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ME_KEY });

  async function start() {
    setStarting(true);
    setError(null);
    try { setSetup(await api<TwoFactorSetupDto>("/api/me/2fa", { method: "POST" })); }
    catch (e) { setError(errorText(e)); }
    finally { setStarting(false); }
  }

  return (
    <Panel icon={SecureIcon} title="Two-factor authentication" description="A one-time code from an authenticator app" legend={TWO_FACTOR_LEGEND}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip health={user.twoFactorEnabled ? "healthy" : "stopped"} label={user.twoFactorEnabled ? "On" : "Off"} />
          <span className="text-body-sm text-fg-2">{user.twoFactorEnabled ? "Sign-in asks for a code after your password." : "Sign-in asks for your password only."}</span>
        </div>
        {error && <p role="alert" className="text-body-sm text-down-ink">{error}</p>}
        <div>
          {user.twoFactorEnabled
            ? <Button variant="secondary" onClick={() => setDisabling(true)}>Turn off two-factor authentication</Button>
            : <Button onClick={() => void start()} disabled={starting}>{starting && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Turn on two-factor authentication</Button>}
        </div>
      </div>
      {setup && <TwoFactorSetup setup={setup} onCancel={() => setSetup(null)} onDone={(c) => { setSetup(null); setCodes(c); void refresh(); }} />}
      {codes && (
        <SecretOnceDialog title="Save your recovery codes" secret={codes} label="recovery code"
          notes={["Each code works once if you lose access to your authenticator app.", "This is the only time they are shown.", "Store them somewhere safe, such as a password manager."]}
          onClose={() => setCodes(null)} />
      )}
      <ConfirmActionDialog open={disabling} onOpenChange={(o) => { setDisabling(o); if (!o) setPassword(""); }} auditFields={false} reasons={[]}
        title="Turn off two-factor authentication" description="Sign-in will ask for your password only."
        impact={["Your recovery codes stop working."]} actionLabel="Turn off" destructive
        extra={(
          <div className="grid gap-1.5">
            <label htmlFor="tf-off-pw" className="text-label text-fg">{user.isLdap ? "Directory password" : "Password"}</label>
            <Input id="tf-off-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        onConfirm={async () => {
          if (!password) throw new Error("Enter your password to continue.");
          await api("/api/me/2fa", { method: "DELETE", body: JSON.stringify({ password }) });
          setPassword("");
          await refresh();
        }} />
    </Panel>
  );
}
