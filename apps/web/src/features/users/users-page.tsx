"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ActionMenu, BlockedButton, ConfirmActionDialog, type DataTablePaging, DataTable, FilterMenu, Notice, Panel, QueryInput, StatusLegend, Toolbar } from "@starterkit/ui/ds";
import { HEALTH } from "@starterkit/ui/lib/status";
import { Button } from "@starterkit/ui/ui/button";
import { UsersIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/sonner";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { BulkResult } from "@/lib/shared/contracts/common";
import type { UserDto } from "@/lib/shared/contracts/users";
import { userColumns } from "./user-columns";
import { SKIP_REASON, USERS_KEY, type UserFilters, protection, useLastSuperadminId, useRoleNames, useUserList } from "./use-users";

const SORTS = [
  { value: "name", label: "Name A–Z" }, { value: "-name", label: "Name Z–A" }, { value: "email", label: "Email A–Z" },
  { value: "-lastLoginAt", label: "Last sign-in, newest" }, { value: "-createdAt", label: "Created, newest" },
] as const;
const STATUSES = [{ value: "", label: "Any" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] as const;
const LEGEND = (["healthy", "stopped"] as const).map((h) => ({ health: h, label: h === "healthy" ? "Active" : "Inactive", description: h === "healthy" ? "Can sign in." : HEALTH.stopped.description }));
const SELECT = "h-8 rounded-md border border-line-strong bg-card px-2.5 text-body text-fg outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft";

type BulkAction = "activate" | "deactivate" | "delete" | "assignRole";
type Pending = { kind: "bulk"; action: BulkAction; ids: string[] } | { kind: "one"; action: "deactivate" | "delete"; user: UserDto };

const VERB: Record<BulkAction, string> = { activate: "Activate", deactivate: "Deactivate", delete: "Delete", assignRole: "Assign role to" };
const BULK_NOTE: Record<BulkAction, string> = {
  activate: "Users who are already active stay as they are.",
  deactivate: "Your own account and the last active Superadmin are skipped.",
  delete: "Your own account and the last active Superadmin are skipped.",
  assignRole: "Your own account is skipped, and so is any user when your role doesn't hold every permission of the chosen role.",
};
const LABEL: Record<BulkAction, string> = { activate: "Activate users", deactivate: "Deactivate users", delete: "Delete users", assignRole: "Assign role" };

/** Filters live in the URL (q, role, status, sort); Load more extends the list. */
function useFilters(): [UserFilters, (patch: Partial<UserFilters>) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const st = sp.get("status");
  const sort = sp.get("sort") ?? "name";
  const f: UserFilters = {
    q: sp.get("q") ?? "", role: sp.get("role") ?? "", status: st === "active" || st === "inactive" ? st : "",
    sort: SORTS.some((s) => s.value === sort) ? sort : "name",
  };
  const set = (patch: Partial<UserFilters>) => {
    const next = { ...f, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "sort" && v === "name")) p.set(k, v);
    router.replace(p.size ? `${path}?${p}` : path, { scroll: false });
  };
  return [f, set];
}

export function UsersPage() {
  const { user: me, can } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [f, setFilters] = useFilters();
  const list = useUserList(f);
  const roles = useRoleNames();
  const lastSuperId = useLastSuperadminId();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [role, setRole] = useState("");

  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total;
  const canAct = can("user.edit") || can("user.delete");
  const filtered = f.q !== "" || f.role !== "" || f.status !== "";
  const change = useCallback((patch: Partial<UserFilters>) => { setSelected(new Set()); setFilters(patch); }, [setFilters]);
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
      const r = await api<BulkResult>("/api/users/bulk", { method: "POST", body: JSON.stringify({ action: p.action, ids: p.ids, ...(p.action === "assignRole" ? { role } : {}) }) });
      const reasons = [...new Set(r.skipped.map((s) => SKIP_REASON[s.code] ?? s.code))].join(", ");
      const text = `${r.done.length} updated, ${r.skipped.length} skipped`;
      if (r.skipped.length && !r.done.length) toast.error(text, { description: `Skipped: ${reasons}.` });
      else toast(text, { description: r.skipped.length ? `Skipped: ${reasons}.` : undefined });
      setSelected(new Set());
    }
    await refresh();
  }

  async function activate(u: UserDto) {
    try {
      await api(`/api/users/${u.id}/status`, { method: "POST", body: JSON.stringify({ active: true }) });
      toast(`Activated ${u.name}.`);
      await refresh();
    } catch (e) { toast.error(errorText(e)); }
  }

  const paging: DataTablePaging = { mode: "infinite", hasMore: !!list.hasNextPage, loadingMore: list.isFetchingNextPage, onLoadMore: () => void list.fetchNextPage(), total, error: list.isFetchNextPageError };
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
      {list.error && list.data && <Notice tone="warn" live>Couldn&apos;t refresh the list; showing the last loaded users.</Notice>}
      <Toolbar end={<StatusLegend items={LEGEND} />}>
        <div className="w-full max-w-80"><QueryInput value={f.q} onChange={(q) => change({ q })} keys={[]} label="Search users" placeholder="Search name, username or email" /></div>
        <FilterMenu label="Role" value={f.role} options={[{ value: "", label: "Any" }, ...(roles.data ?? []).map((r) => ({ value: r, label: r }))]} onChange={(role) => change({ role })} />
        <FilterMenu label="Status" value={f.status} options={STATUSES} onChange={(status) => change({ status })} />
        <FilterMenu label="Sort by" value={f.sort} options={SORTS} onChange={(sort) => change({ sort })} />
        {filtered && <Button variant="ghost" size="sm" onClick={() => change({ q: "", role: "", status: "" })}>Clear filters</Button>}
      </Toolbar>
      <Panel flush icon={UsersIcon} title="Users" count={total} description="Select rows for bulk actions">
        {canAct && rows.length > 0 && (
          <div role="region" aria-label="Bulk actions" className="flex min-h-12 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <label className="flex items-center gap-2 text-body-sm text-fg-2">
              <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={selected.size > 0 && rows.every((u) => selected.has(u.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((u) => u.id)) : new Set())} />
              {selected.size > 0 ? `${selected.size} selected` : `Select all ${rows.length} loaded`}
            </label>
            {selected.size > 0 && <>
              {can("user.edit") && <>
                <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "bulk", action: "activate", ids })}>Activate</Button>
                <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "bulk", action: "deactivate", ids })}>Deactivate</Button>
                <Button size="sm" variant="secondary" onClick={() => { setRole(roles.data?.[0] ?? ""); setPending({ kind: "bulk", action: "assignRole", ids }); }}>Assign role</Button>
              </>}
              {can("user.delete") && <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "bulk", action: "delete", ids })}>Delete</Button>}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </>}
          </div>
        )}
        <DataTable label="Users" rowHeight="identity" columns={columns} rows={rows} rowKey={(u) => u.id} loading={list.isPending}
          isSelected={(u) => selected.has(u.id)} paging={paging}
          error={list.error && !list.data ? { title: "Couldn't load users", cause: errorText(list.error), onRetry: () => void list.refetch() } : null}
          empty={filtered
            ? { icon: UsersIcon, title: "No users match", description: "Change the search or filters, or clear them to see every user." }
            : { icon: UsersIcon, title: "No users yet", description: "Users appear here after you create them." }}
          rowActions={(u) => {
            const block = protection(u, me.id, lastSuperId);
            return <>
              {can("user.edit") && (u.isActive
                ? <BlockedButton reason={block} size="sm" variant="ghost" onClick={() => setPending({ kind: "one", action: "deactivate", user: u })}>Deactivate</BlockedButton>
                : <Button size="sm" variant="ghost" onClick={() => void activate(u)}>Activate</Button>)}
              <ActionMenu label={`Actions for ${u.name}`} actions={[
                { id: "open", label: "View user", onSelect: () => router.push(`/users/${u.id}`) },
                ...(can("user.edit") ? [{ id: "edit", label: "Edit user", onSelect: () => router.push(`/users/${u.id}/edit`) }] : []),
                ...(can("user.delete") ? [{ id: "delete", label: "Delete user", destructive: true, disabled: !!block, hint: block ?? undefined, onSelect: () => setPending({ kind: "one", action: "delete", user: u }) }] : []),
              ]} />
            </>;
          }} />
      </Panel>
      {dialog && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setPending(null); }} auditFields={false} reasons={[]} destructive={destructive}
          title={dialog.title} description={dialog.description} impact={impact} actionLabel={dialog.label} onConfirm={confirm}
          extra={pending?.action === "assignRole" && (
            <div className="grid gap-1.5">
              <label htmlFor="bulk-role" className="text-label text-fg">Role</label>
              <select id="bulk-role" className={SELECT} value={role} onChange={(e) => setRole(e.target.value)}>
                {(roles.data ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )} />
      )}
    </div>
  );
}
