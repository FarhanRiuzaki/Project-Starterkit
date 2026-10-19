"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmActionDialog, type Column, DataTable, Failure, Facts, Notice, Panel, RelativeTime, SecretOnceDialog } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { ActivityIcon, KeyIcon, LogIcon, SecureIcon, SessionsIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { toast } from "@starterkit/ui/ui/sonner";
import { PageHeader } from "@/components/shell/page-header";
import { api } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { SessionDto } from "@/lib/shared/contracts/me";
import type { ActivityBrief } from "@/lib/shared/contracts/users";
import { MODULES } from "@/lib/shared/permissions";
import { BlockedButton } from "./blocked-button";
import { RoleChips, UserStatusChip } from "./user-columns";
import { USERS_KEY, errText, protection, useLastSuperadminId, useUserDetail } from "./use-users";

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const PROVIDER = { google: "Google", apple: "Apple" } as const;

const SESSION_COLUMNS: Column<SessionDto>[] = [
  { key: "device", header: "Device", cell: (s) => <span className="font-medium text-fg">{s.device}{s.current && <span className="ml-2 text-caption font-normal text-primary-ink">Your session</span>}</span> },
  { key: "ip", header: "IP address", cell: (s) => <span className="font-mono text-mono">{s.ip}</span> },
  { key: "last", header: "Last active", cell: (s) => <RelativeTime at={Date.parse(s.lastSeenAt)} /> },
];
const ACTIVITY_COLUMNS: Column<ActivityBrief>[] = [
  { key: "at", header: "When", cell: (a) => <RelativeTime at={Date.parse(a.at)} /> },
  { key: "actor", header: "By", cell: (a) => a.actor.name },
  { key: "action", header: "Action", cell: (a) => <span className="font-mono text-mono">{a.action}</span> },
];

type Dialog = "deactivate" | "delete" | "reset" | { end: SessionDto } | null;

export function UserDetail({ id }: { id: string }) {
  const { user: me, can } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useUserDetail(id);
  const lastSuperId = useLastSuperadminId();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [temp, setTemp] = useState<string | null>(null);

  if (q.error && !q.data) return <div className="grid gap-section"><PageHeader title="User" /><Panel><Failure title="Couldn't load this user" error={q.error} source="Starterkit" onRetry={() => void q.refetch()} /></Panel></div>;
  const u = q.data;
  if (!u) return <div className="grid gap-section" aria-busy="true"><PageHeader title="User" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const refresh = () => qc.invalidateQueries({ queryKey: USERS_KEY });
  const block = protection(u, me.id, lastSuperId);
  const resetBlock = u.id === me.id ? "Use Security in your account to change your own password." : u.isLdap ? "This user signs in with a directory password. Change it in your directory." : null;
  const granted = new Set<string>(u.permissions);

  async function setActive(active: boolean) {
    await api(`/api/users/${id}/status`, { method: "POST", body: JSON.stringify({ active }) });
    toast(active ? `Activated ${u!.name}.` : `Deactivated ${u!.name}. Their sessions ended.`);
    await refresh();
  }

  return (
    <div className="grid gap-section">
      <PageHeader title={u.name} status={<UserStatusChip user={u} />} description={`${u.username} · ${u.email}`}
        actions={<>
          {can("user.edit") && <Button asChild variant="secondary"><Link href={`/users/${id}/edit`}>Edit user</Link></Button>}
          {can("user.edit") && <BlockedButton variant="secondary" reason={resetBlock} onClick={() => setDialog("reset")}>Reset password</BlockedButton>}
          {can("user.edit") && (u.isActive
            ? <BlockedButton variant="secondary" reason={block} onClick={() => setDialog("deactivate")}>Deactivate user</BlockedButton>
            : <Button variant="secondary" onClick={() => void setActive(true).catch((e) => toast.error(errText(e)))}>Activate user</Button>)}
          {can("user.delete") && <BlockedButton variant="destructive" reason={block} onClick={() => setDialog("delete")}>Delete user</BlockedButton>}
        </>} />
      {q.error && <Notice tone="warn" live>Couldn&apos;t refresh this user; showing the last loaded details.</Notice>}
      <div className="grid items-start gap-gutter lg:grid-cols-2">
        <Panel icon={UsersIcon} title="Details" description="Account facts">
          <Facts items={[
            { label: "Sign-in", value: u.isLdap ? "Directory" : "Password" },
            { label: "Two-step sign-in", value: u.twoFactorEnabled ? "On" : "Off" },
            { label: "Last sign-in", value: <RelativeTime at={u.lastLoginAt ? Date.parse(u.lastLoginAt) : null} /> },
            { label: "Created", value: <RelativeTime at={Date.parse(u.createdAt)} /> },
          ]} />
        </Panel>
        <Panel icon={SecureIcon} title="Roles and connected accounts" description="Roles decide the permissions below">
          <div className="grid gap-3">
            <RoleChips roles={u.roles} />
            <p className="text-body-sm text-fg-2">Connected accounts: {u.connected.length ? u.connected.map((c) => PROVIDER[c]).join(", ") : "none"}</p>
          </div>
        </Panel>
        <Panel icon={KeyIcon} title="Effective permissions" description="Combined from all roles, by module" className="lg:col-span-2">
          <dl className="grid gap-2">
            {MODULES.map((m) => {
              const have = m.actions.filter((a) => granted.has(`${m.key}.${a}`));
              return (
                <div key={m.key} className="flex items-baseline gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
                  <dt className="w-28 shrink-0 text-label text-fg">{cap(m.key)}</dt>
                  <dd className="text-body-sm text-fg-2">{have.length ? have.map(cap).join(", ") : "No access"}</dd>
                </div>
              );
            })}
          </dl>
        </Panel>
      </div>
      <Panel flush icon={SessionsIcon} title="Active sessions" description="Where this user is signed in" count={u.sessions.length}>
        <DataTable label="Active sessions" columns={SESSION_COLUMNS} rows={u.sessions} rowKey={(s) => s.id}
          rowActions={can("user.edit") ? (s) => (s.current ? <span className="text-caption text-fg-3">Your session</span> : <Button size="sm" variant="ghost" onClick={() => setDialog({ end: s })}>End session</Button>) : undefined}
          empty={{ icon: SessionsIcon, title: "No active sessions", description: "Sessions appear here when this user signs in." }} />
      </Panel>
      {u.recentActivity && (
      <Panel flush icon={LogIcon} title="Recent activity" description="The last 20 actions on this user" count={u.recentActivity.length}>
        <DataTable label="Recent activity" columns={ACTIVITY_COLUMNS} rows={u.recentActivity} rowKey={(a) => a.id}
          empty={{ icon: ActivityIcon, title: "No activity yet", description: "Changes to this user appear here." }} />
      </Panel>
      )}

      {dialog === "deactivate" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} title={`Deactivate ${u.name}`} description={u.email}
          impact={["They are signed out and can't sign in until reactivated."]} actionLabel="Deactivate user" onConfirm={() => setActive(false)} />
      )}
      {dialog === "delete" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} destructive title={`Delete ${u.name}`} description={u.email}
          impact={["The account is removed and its sessions end.", "This can't be undone."]} actionLabel="Delete user"
          onConfirm={async () => { await api(`/api/users/${id}`, { method: "DELETE" }); toast(`Deleted ${u.name}.`); await refresh(); router.push("/users"); }} />
      )}
      {dialog === "reset" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} title={`Reset password for ${u.name}`} description={u.email}
          impact={["A temporary password replaces the current one.", "Their sessions end."]} actionLabel="Reset password"
          onConfirm={async () => { const r = await api<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`, { method: "POST" }); setTemp(r.temporaryPassword); await refresh(); }} />
      )}
      {typeof dialog === "object" && dialog && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} destructive title="End this session" description={`${dialog.end.device} · ${dialog.end.ip}`}
          impact={["That device is signed out and must sign in again."]} actionLabel="End session"
          onConfirm={async () => { await api(`/api/users/${id}/sessions/${encodeURIComponent(dialog.end.id)}`, { method: "DELETE" }); await refresh(); }} />
      )}
      {temp && (
        <SecretOnceDialog title="Temporary password" secret={temp} label="Temporary password" onClose={() => setTemp(null)}
          notes={[`Share this password with ${u.name} through a secure channel.`, "It is shown once and can't be retrieved later.", "Ask them to change it from Security after signing in."]} />
      )}
    </div>
  );
}
