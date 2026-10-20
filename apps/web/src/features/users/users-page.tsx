"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ActionMenu, BlockedButton, ConfirmActionDialog, DataTable, Field, FilterMenu, Notice, Panel, QueryInput, Toolbar } from "@starterkit/ui/ds";
import { HEALTH } from "@starterkit/ui/lib/status";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { Select } from "@starterkit/ui/ui/select";
import { toast } from "@starterkit/ui/ui/toast";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useTableQuery } from "@/lib/client/use-table-query";
import type { BulkResult } from "@starterkit/shared/contracts/common";
import type { UserRowDto } from "@starterkit/shared/contracts/users";
import { USER_STATUSES, type UserFilters, USERS } from "@/lib/shared/queries";
import { RoleSearch } from "./role-search";
import { userColumns } from "./user-columns";
import { skipReason, USERS_KEY, protection, rankBlock, useLastSuperadminId, useRoleNames } from "./use-users";

const STATUS_LABEL = { "": "Any", active: "Active", inactive: "Inactive" } as const;
const STATUSES = USER_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }));
const LEGEND = (["healthy", "stopped"] as const).map((h) => ({ health: h, label: h === "healthy" ? "Active" : "Inactive", description: h === "healthy" ? "Can sign in." : HEALTH.stopped.description }));

type BulkAction = "activate" | "deactivate" | "delete" | "assignRole";
type Pending = { kind: "bulk"; action: BulkAction; ids: string[] } | { kind: "one"; action: "deactivate" | "delete"; user: UserRowDto };

const VERB: Record<BulkAction, string> = { activate: "Activate", deactivate: "Deactivate", delete: "Delete", assignRole: "Assign role to" };
const BULK_NOTE: Record<BulkAction, string> = {
  activate: "Users who are already active stay as they are. Users with permissions your role doesn't hold are skipped.",
  deactivate: "Your own account, the last active Superadmin and users with permissions your role doesn't hold are skipped.",
  delete: "Your own account, the last active Superadmin and users with permissions your role doesn't hold are skipped.",
  assignRole: "Your own account and users with permissions your role doesn't hold are skipped, and so is everyone when your role doesn't hold every permission of the chosen role.",
};
const LABEL: Record<BulkAction, string> = { activate: "Activate users", deactivate: "Deactivate users", delete: "Delete users", assignRole: "Assign role" };

export function UsersPage() {
  const { user: me, perms, can } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const t = useTableQuery<UserRowDto, UserFilters>(USERS);
  const f = t.state;
  const roles = useRoleNames();
  const lastSuperId = useLastSuperadminId();
  // Selection belongs to the rows on screen: another page, size, sort or filter starts empty.
  const shown = `${f.page}|${f.pageSize}|${f.sort}|${t.filterQuery}`;
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedOn, setSelectedOn] = useState(shown);
  if (selectedOn !== shown) { setSelectedOn(shown); setSelected(new Set()); }
  const [pending, setPending] = useState<Pending | null>(null);
  const [role, setRole] = useState("");
  const [activating, setActivating] = useState<string | null>(null);

  const rows = t.rows;
  const canAct = can("user.edit") || can("user.delete");
  const filtered = f.q !== "" || f.role !== "" || f.status !== "";
  const set = t.set;
  const onSearch = useCallback((q: string) => set({ q }), [set]);
  const onRole = useCallback((role: string) => set({ role }), [set]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const columns = useMemo(() => userColumns(canAct ? { has: (id) => selected.has(id), toggle } : undefined), [canAct, selected]);

  const refresh = () => qc.invalidateQueries({ queryKey: USERS_KEY });

  async function confirm() {
    const p = pending!;
    if (p.kind === "one") {
      if (p.action === "delete") await api(`/api/users/${p.user.id}`, { method: "DELETE" });
      else await api(`/api/users/${p.user.id}/status`, { method: "POST", body: JSON.stringify({ active: false }) });
      toast(p.action === "delete" ? `Deleted ${p.user.name}.` : `Deactivated ${p.user.name}. Their sessions ended.`);
    } else {
      if (p.action === "assignRole" && !role) throw new Error("Pick a role: type its name and choose it from the list.");
      const r = await api<BulkResult>("/api/users/bulk", { method: "POST", body: JSON.stringify({ action: p.action, ids: p.ids, ...(p.action === "assignRole" ? { role } : {}) }) });
      const reasons = [...new Set(r.skipped.map((s) => skipReason(s.code)))].join(", ");
      const text = `${r.done.length} updated, ${r.skipped.length} skipped`;
      if (r.skipped.length && !r.done.length) toast.error(text, { description: `Skipped: ${reasons}.` });
      else toast(text, { description: r.skipped.length ? `Skipped: ${reasons}.` : undefined });
      setSelected(new Set());
    }
    await refresh();
  }

  async function activate(u: UserRowDto) {
    setActivating(u.id);
    try {
      await api(`/api/users/${u.id}/status`, { method: "POST", body: JSON.stringify({ active: true }) });
      toast(`Activated ${u.name}.`);
      await refresh();
    } catch (e) { toast.error(errorText(e)); }
    finally { setActivating(null); }
  }

  const ids = [...selected];
  const dialog = pending && (pending.kind === "bulk"
    ? { title: `${VERB[pending.action]} ${pending.ids.length} ${pending.ids.length === 1 ? "user" : "users"}`, description: BULK_NOTE[pending.action], label: LABEL[pending.action] }
    : { title: `${pending.action === "delete" ? "Delete" : "Deactivate"} ${pending.user.name}`, description: pending.user.email, label: pending.action === "delete" ? "Delete user" : "Deactivate user" });
  const destructive = pending?.action === "delete";
  const impact = !pending ? [] : pending.action === "delete" ? ["The account is removed and its sessions end.", "This can't be undone."]
    : pending.action === "deactivate" ? ["They are signed out and can't sign in until reactivated."]
    : pending.action === "assignRole" ? ["The role is added to each user's current roles."] : ["They can sign in again."];

  return (
    <div className="grid gap-section">
      <PageHeader title="Users" description="Accounts that can sign in, their roles and status."
        actions={can("user.create") ? <Button asChild><Link href="/users/new">Create user</Link></Button> : undefined} />
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the users; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Toolbar>
        <div className="w-full max-w-80"><QueryInput value={f.q} onChange={onSearch} keys={[]} label="Search users" placeholder="Search name, username or email" /></div>
        {roles.more
          ? <RoleSearch label="Role" value={f.role} onChange={onRole} />
          : <FilterMenu label="Role" value={f.role} options={[{ value: "", label: "Any" }, ...roles.names.map((r) => ({ value: r, label: r }))]} onChange={onRole} />}
        <FilterMenu label="Status" value={f.status} options={STATUSES} onChange={(status) => set({ status })} />
        {filtered && <Button variant="ghost" size="sm" onClick={() => set({ q: "", role: "", status: "" })}>Clear filters</Button>}
      </Toolbar>
      <Panel flush icon={UsersIcon} title="Users" count={t.count} description="Select rows for bulk actions" legend={LEGEND}>
        {canAct && rows.length > 0 && (
          <div role="region" aria-label="Bulk actions" className="flex min-h-12 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <label className="flex items-center gap-2 text-body-sm text-fg-2">
              <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={selected.size > 0 && rows.every((u) => selected.has(u.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((u) => u.id)) : new Set())} />
              {selected.size > 0 ? `${selected.size} selected` : `Select all ${rows.length} on this page`}
            </label>
            {selected.size > 0 && <>
              {can("user.edit") && <>
                <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "bulk", action: "activate", ids })}>Activate</Button>
                <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "bulk", action: "deactivate", ids })}>Deactivate</Button>
                <Button size="sm" variant="secondary" onClick={() => { setRole(roles.more ? "" : roles.names[0] ?? ""); setPending({ kind: "bulk", action: "assignRole", ids }); }}>Assign role</Button>
              </>}
              {can("user.delete") && <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "bulk", action: "delete", ids })}>Delete</Button>}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </>}
          </div>
        )}
        <DataTable label="Users" rowHeight="identity" columns={columns} rows={rows} rowKey={(u) => u.id} loading={t.loading}
          isSelected={(u) => selected.has(u.id)} sort={t.sort} onSortChange={t.onSortChange} paging={t.paging}
          error={t.loadError ? { title: "Couldn't load users", cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={filtered
            ? { icon: UsersIcon, title: "No users match", description: "Change the search or filters, or clear them to see every user." }
            : { icon: UsersIcon, title: "No users yet", description: "Users appear here after you create them." }}
          rowActions={(u) => {
            const block = protection(u, me.id, perms, lastSuperId);
            const rank = rankBlock(u, perms);
            return <>
              {can("user.edit") && (u.isActive
                ? <BlockedButton reason={block} size="sm" variant="ghost" onClick={() => setPending({ kind: "one", action: "deactivate", user: u })}>Deactivate</BlockedButton>
                : <BlockedButton reason={rank} size="sm" variant="ghost" disabled={activating === u.id} aria-busy={activating === u.id || undefined} onClick={() => void activate(u)}>
                  {activating === u.id && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Activate</BlockedButton>)}
              <ActionMenu label={`Actions for ${u.name}`} actions={[
                { id: "open", label: "View user", onSelect: () => router.push(`/users/${u.id}`) },
                ...(can("user.edit") ? [{ id: "edit", label: "Edit user", disabled: !!rank, hint: rank ?? undefined, onSelect: () => router.push(`/users/${u.id}/edit`) }] : []),
                ...(can("user.delete") ? [{ id: "delete", label: "Delete user", destructive: true, disabled: !!block, hint: block ?? undefined, onSelect: () => setPending({ kind: "one", action: "delete", user: u }) }] : []),
              ]} />
            </>;
          }} />
      </Panel>
      {dialog && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setPending(null); }} auditFields={false} reasons={[]} destructive={destructive}
          title={dialog.title} description={dialog.description} impact={impact} actionLabel={dialog.label} onConfirm={confirm}
          extra={pending?.action === "assignRole" && (
            <Field id="bulk-role" label="Role">
              {roles.more
                ? <RoleSearch id="bulk-role" label="Role" value={role} onChange={setRole} />
                : <Select id="bulk-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={roles.names.length === 0}>
                  {roles.names.length === 0
                    ? <option value="">No roles yet. Create one on the Roles page.</option>
                    : roles.names.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>}
            </Field>
          )} />
      )}
    </div>
  );
}
