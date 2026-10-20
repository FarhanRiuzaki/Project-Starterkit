"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { BlockedButton, type Column, DataTable, Failure, Notice, Panel, RelativeTime } from "@starterkit/ui/ds";
import { Stagger, StaggerItem, useDelayedFlag } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { ActivityIcon, KeyIcon, LogIcon, SecureIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { DetailNotFound } from "@/components/detail-not-found";
import { RoleChips } from "@/components/role-chips";
import { LoadingShape } from "@/components/route-skeleton";
import { SessionsTable } from "@/components/sessions-table";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText, isNotFound } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { SessionDto } from "@starterkit/shared/contracts/me";
import { actionLabel } from "@starterkit/shared/audit";
import type { ActivityBrief } from "@starterkit/shared/contracts/users";
import { MODULES, permissionLabel } from "@starterkit/shared/permissions";
import { userDetail, userSessions } from "@/lib/shared/queries";
import { BRAND } from "@starterkit/shared/brand";
import { UserStatusChip } from "./user-columns";
import { USERS_KEY, protection, rankBlock, useLastSuperadminId, userGone, useUserDetail } from "./use-users";
import { USER_DETAIL_SHAPE } from "./shapes";

const PROVIDER = { google: "Google", apple: "Apple" } as const;

/** Opened on click only: the dialogs load then, outside the page's first load (route budget, AGENTS.md §9). */
const ConfirmActionDialog = dynamic(() => import("@starterkit/ui/ds").then((m) => m.ConfirmActionDialog), { ssr: false });
const SecretOnceDialog = dynamic(() => import("@starterkit/ui/ds").then((m) => m.SecretOnceDialog), { ssr: false });

const ACTIVITY_COLUMNS: Column<ActivityBrief>[] = [
  { key: "at", header: "When", cell: (a) => <RelativeTime at={Date.parse(a.at)} /> },
  { key: "actor", header: "By", cell: (a) => a.actor.name },
  { key: "action", header: "Action", mobile: "title", cell: (a) => actionLabel(a.action) },
];

/** Label / value rows of the detail cards (Details, Effective permissions): one look for both. */
function Rows({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
          <dt className="w-28 shrink-0 text-label text-fg">{i.label}</dt>
          <dd className="min-w-0 text-body-sm text-fg-2">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Dialog = "delete" | "reset" | { end: SessionDto } | null;


export function UserDetail({ id }: { id: string }) {
  const { user: me, perms, can } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  /** Set once this page deleted the user: stop fetching them (no 404 flash), drop them from the cache when the page goes away. */
  const [deleted, setDeleted] = useState(false);
  const q = useUserDetail(id, !deleted);
  // No flash: the loading shape appears after 150 ms and then stays at least 300 ms (it holds its place hidden before).
  const skeleton = useDelayedFlag(!q.data && !q.error);
  const lastSuperId = useLastSuperadminId();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  useEffect(() => () => { if (deleted) qc.removeQueries({ queryKey: userDetail(id).key }); }, [deleted, id, qc]);

  if (isNotFound(q.error)) return <DetailNotFound title="User" noun="user" list={{ href: "/users", label: "Users" }} />;
  if (q.error && !q.data) return <div className="grid gap-section"><PageHeader title="User" /><Panel><Failure title="Couldn't load this user" error={q.error} source={BRAND.name} onRetry={() => void q.refetch()} /></Panel></div>;
  const u = q.data;
  if (!u || skeleton) return <LoadingShape sections={USER_DETAIL_SHAPE} shown={skeleton} />;

  /** Every users query but this user's own detail once it's deleted (it would answer 404). */
  const refresh = () => qc.invalidateQueries({ queryKey: USERS_KEY, predicate: (x) => !(deleted && x.queryKey[2] === id) });
  const rank = rankBlock(u, perms);
  const block = protection(u, me.id, perms, lastSuperId);
  const resetBlock = u.id === me.id ? "Use Security in your account to change your own password." : rank ?? (u.isLdap ? "This user signs in with a directory password. Change it in your directory." : null);
  const granted = new Set<string>(u.permissions);

  // No confirmation: the result toast offers Undo (deactivating can be reversed; delete still confirms).
  async function setActive(active: boolean) {
    setActivating(true);
    try {
      await api(`/api/users/${id}/status`, { method: "POST", body: JSON.stringify({ active }) });
      if (active) toast(`Activated ${u!.name}.`);
      else toast.undo(`Deactivated ${u!.name}.`, () => void setActive(true), { description: "Their sessions ended. Undo lets them sign in again." });
      await refresh();
    } catch (e) { toast.error(errorText(e)); }
    finally { setActivating(false); }
  }
  async function remove(name: string) {
    await api(`/api/users/${id}`, { method: "DELETE" });
    // Leave first and stop the detail query, so the page never refetches itself into a "doesn't exist" flash.
    setDeleted(true);
    router.push("/users");
    toast(`Deleted ${name}.`);
    await qc.invalidateQueries({ queryKey: USERS_KEY, predicate: (x) => x.queryKey[2] !== id });
  }

  return (
    <div className="grid gap-section">
      <PageHeader title={u.name} status={<UserStatusChip user={u} />} description={`${u.username} · ${u.email}`}
        actions={can("user.edit") && (rank
          ? <BlockedButton variant="secondary" reason={rank}>Edit user</BlockedButton>
          : <Button asChild variant="secondary"><Link href={`/users/${id}/edit`}>Edit user</Link></Button>)}
        more={[
          ...(can("user.edit") ? [
            { label: "Reset password", reason: resetBlock, onSelect: () => setDialog("reset") },
            u.isActive
              ? { label: "Deactivate user", reason: block, busy: activating, onSelect: () => void setActive(false) }
              : { label: "Activate user", reason: rank, busy: activating, onSelect: () => void setActive(true) },
          ] : []),
          ...(can("user.delete") ? [{ label: "Delete user", reason: block, destructive: true, onSelect: () => setDialog("delete") }] : []),
        ]} />
      {q.error && <Notice tone="warn" live>Couldn&apos;t refresh this user; showing the last loaded details.</Notice>}
      {/* First data reveal: the cards rise in one after another (a refetch keeps them, so nothing replays). */}
      <Stagger className="grid gap-gutter md:grid-cols-2">
        <StaggerItem index={0} className="grid"><Panel icon={UsersIcon} title="Details" description="Account facts">
          <Rows items={[
            { label: "Sign-in", value: u.isLdap ? "Directory" : "Password" },
            { label: "2FA", value: u.twoFactorEnabled ? "On" : "Off" },
            { label: "Last sign-in", value: <RelativeTime at={u.lastLoginAt ? Date.parse(u.lastLoginAt) : null} /> },
            { label: "Created", value: <RelativeTime at={Date.parse(u.createdAt)} /> },
          ]} />
        </Panel></StaggerItem>
        <StaggerItem index={1} className="grid"><Panel icon={SecureIcon} title="Roles and connected accounts" description="Roles decide the permissions below">
          <div className="grid gap-3">
            <RoleChips roles={u.roles} />
            <p className="text-body-sm text-fg-2">Connected accounts: {u.connected.length ? u.connected.map((c) => PROVIDER[c]).join(", ") : "none"}</p>
          </div>
        </Panel></StaggerItem>
        <StaggerItem index={2} className="grid md:col-span-2"><Panel icon={KeyIcon} title="Effective permissions" description="Combined from all roles, by module">
          <Rows items={MODULES.map((m) => {
            // The app's actions in order, then any added to the catalog that this user holds (user.export).
            const added = u.permissions.filter((p) => p.startsWith(`${m.key}.`)).map((p) => p.slice(m.key.length + 1)).filter((a) => !(m.actions as string[]).includes(a));
            const have = [...m.actions.filter((a) => granted.has(`${m.key}.${a}`)), ...added];
            return { label: permissionLabel(m.key), value: have.length ? have.map(permissionLabel).join(", ") : "No access" };
          })} />
        </Panel></StaggerItem>
      </Stagger>
      {/* End session: no touch caption in the row; the same `rank` reason is the caption of the header's Edit user. */}
      <SessionsTable table={userSessions(id)} enabled={!userGone(q.error, deleted)} title="Active sessions" description="Where this user is signed in"
        current="Your session" emptyHint="Sessions appear here when this user signs in."
        action={can("user.edit") ? (s) => (s.current ? <span className="text-caption text-fg-3">Your session</span> : <BlockedButton size="sm" variant="ghost" reason={rank} caption={false} onClick={() => setDialog({ end: s })}>End session</BlockedButton>) : undefined} />
      {u.recentActivity && (
      <Panel flush icon={LogIcon} title="Recent activity" description="The last 20 actions on this user" count={u.recentActivity.length}>
        <DataTable label="Recent activity" columns={ACTIVITY_COLUMNS} rows={u.recentActivity} rowKey={(a) => a.id}
          empty={{ icon: ActivityIcon, title: "No activity yet", description: "Changes to this user appear here." }} />
      </Panel>
      )}

      {dialog === "delete" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} destructive title={`Delete ${u.name}`} description={u.email}
          impact={["The account is removed and its sessions end.", "This can't be undone."]} actionLabel="Delete user"
          onConfirm={() => remove(u.name)} />
      )}
      {dialog === "reset" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} title={`Reset password for ${u.name}`} description={u.email}
          impact={["A temporary password replaces the current one.", "Their sessions end."]} actionLabel="Reset password"
          onConfirm={async () => { const r = await api<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`, { method: "POST" }); setTemp(r.temporaryPassword); await refresh(); }} />
      )}
      {typeof dialog === "object" && dialog && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} destructive title="End this session" description={`${dialog.end.device} · ${dialog.end.ip}`}
          impact={["That device is signed out and must sign in again."]} actionLabel="End session"
          onConfirm={async () => { await api(`/api/users/${id}/sessions/${encodeURIComponent(dialog.end.id)}`, { method: "DELETE" }); toast(`Ended the session on ${dialog.end.device}.`); await refresh(); }} />
      )}
      {temp && (
        <SecretOnceDialog title="Temporary password" secret={temp} label="Temporary password" onClose={() => setTemp(null)}
          notes={[`Share this password with ${u.name} through a secure channel.`, "It is shown once and can't be retrieved later.", "Ask them to change it from Security after signing in."]} />
      )}
    </div>
  );
}
