"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ActionMenu, BlockedButton, DataTable, FilterMenu, Notice, Panel, QueryInput, Toolbar, ToolbarFilters } from "@starterkit/ui/ds";
import { cn } from "@starterkit/ui/lib/cn";
import { HEALTH } from "@starterkit/ui/lib/status";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useTableQuery } from "@/lib/client/use-table-query";
import type { BulkResult } from "@starterkit/shared/contracts/common";
import type { UserRowDto } from "@starterkit/shared/contracts/users";
import { USER_STATUSES, type UserFilters, USERS } from "@/lib/shared/queries";
import { RoleSearch } from "./role-search";
import type { Pending } from "./users-action-dialog";
import { userColumns } from "./user-columns";
import { skipReason, USERS_KEY, protection, rankBlock, useLastSuperadminId, useRoleNames } from "./use-users";

const STATUS_LABEL = { "": "Any", active: "Active", inactive: "Inactive" } as const;
const STATUSES = USER_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }));
/**
 * The Deactivate / Activate row button is a desktop shortcut (from 1280 px). Below that (phone card, and the tablet
 * table, where it would push the name column into a sideways scroll) and on any touch screen it is an item of the
 * row's Actions menu instead, with its reason inline.
 */
const ROW_ONLY = "max-xl:hidden";
const MENU_ON_TOUCH = "hidden max-xl:flex pointer-coarse:flex";
const LEGEND = (["healthy", "stopped"] as const).map((h) => ({ health: h, label: h === "healthy" ? "Active" : "Inactive", description: h === "healthy" ? "Can sign in." : HEALTH.stopped.description }));

/**
 * The confirm dialog is opened on click only: its own chunk, out of the route's first load (AGENTS.md §9). The import
 * starts on the first press or focus in the page (intent), so it is there by the time a dialog opens.
 */
const loadDialog = () => import("./users-action-dialog");
const UsersActionDialog = dynamic(() => loadDialog().then((m) => m.UsersActionDialog), { ssr: false });
const preloadDialog = () => void loadDialog();

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
  const [changing, setChanging] = useState<string | null>(null);

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
      await api(`/api/users/${p.user.id}`, { method: "DELETE" });
      toast(`Deleted ${p.user.name}.`);
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

  // One user: no confirmation, the result toast offers Undo (it can be reversed); a bulk deactivate still confirms.
  async function setStatus(u: UserRowDto, active: boolean) {
    setChanging(u.id);
    try {
      await api(`/api/users/${u.id}/status`, { method: "POST", body: JSON.stringify({ active }) });
      if (active) toast(`Activated ${u.name}.`);
      else toast.undo(`Deactivated ${u.name}.`, () => void setStatus(u, true), { description: "Their sessions ended. Undo lets them sign in again." });
      await refresh();
    } catch (e) { toast.error(errorText(e)); }
    finally { setChanging(null); }
  }

  const ids = [...selected];

  return (
    <div className="grid gap-section" onPointerDown={preloadDialog} onFocus={preloadDialog}>
      <PageHeader title="Users" description="Accounts that can sign in, their roles and status."
        actions={can("user.create") ? <Button asChild><Link href="/users/new">Create user</Link></Button> : undefined} />
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the users; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Toolbar>
        <div className="w-full max-w-80 max-md:max-w-none"><QueryInput value={f.q} onChange={onSearch} keys={[]} label="Search users" placeholder="Search name, username or email" /></div>
        <ToolbarFilters active={(f.role ? 1 : 0) + (f.status ? 1 : 0)}>
          {roles.more
            ? <RoleSearch label="Role" value={f.role} onChange={onRole} />
            : <FilterMenu label="Role" value={f.role} options={[{ value: "", label: "Any" }, ...roles.names.map((r) => ({ value: r, label: r }))]} onChange={onRole} />}
          <FilterMenu label="Status" value={f.status} options={STATUSES} onChange={(status) => set({ status })} />
          {filtered && <Button variant="ghost" size="sm" onClick={() => set({ q: "", role: "", status: "" })}>Clear filters</Button>}
        </ToolbarFilters>
      </Toolbar>
      <Panel flush icon={UsersIcon} title="Users" count={t.count} description="Select rows for bulk actions" legend={LEGEND}>
        {canAct && rows.length > 0 && (
          // On a phone, with rows selected, the bar sticks under the top bar so the actions stay in reach while scrolling the cards.
          <div role="region" aria-label="Bulk actions" className={cn("flex min-h-12 flex-wrap items-center gap-2 border-b border-line bg-card px-3 py-2",
            selected.size > 0 && "max-md:sticky max-md:top-(--topbar-h) max-md:z-20")}>
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
            // No touch caption in the row (it would stretch the row). Below 1280 px the Deactivate / Activate button
            // moves into the Actions menu, and on any touch screen the menu has it too: there each item shows its reason
            // under the label (Deactivate: `block`, Activate and Edit user: `rank`, Delete user: `block`).
            const busy = changing === u.id;
            return <>
              {can("user.edit") && (u.isActive
                ? <BlockedButton reason={block} caption={false} size="sm" variant="ghost" className={cn(!busy && ROW_ONLY)} wrapClassName={ROW_ONLY} disabled={busy} aria-busy={busy || undefined} onClick={() => void setStatus(u, false)}>
                  {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Deactivate</BlockedButton>
                // While it runs the button stays on the card too: its spinner and aria-busy are the pending state.
                : <BlockedButton reason={rank} caption={false} size="sm" variant="ghost" className={cn(!busy && ROW_ONLY)} wrapClassName={ROW_ONLY} disabled={busy} aria-busy={busy || undefined} onClick={() => void setStatus(u, true)}>
                  {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Activate</BlockedButton>)}
              <ActionMenu label={`Actions for ${u.name}`} actions={[
                { id: "open", label: "View user", onSelect: () => router.push(`/users/${u.id}`) },
                ...(can("user.edit") ? [u.isActive
                  ? { id: "status", label: busy ? "Deactivating…" : "Deactivate user", className: MENU_ON_TOUCH, disabled: !!block || busy, hint: block ?? undefined, onSelect: () => void setStatus(u, false) }
                  : { id: "status", label: busy ? "Activating…" : "Activate user", className: MENU_ON_TOUCH, disabled: !!rank || busy, hint: rank ?? undefined, onSelect: () => void setStatus(u, true) }] : []),
                ...(can("user.edit") ? [{ id: "edit", label: "Edit user", disabled: !!rank, hint: rank ?? undefined, onSelect: () => router.push(`/users/${u.id}/edit`) }] : []),
                ...(can("user.delete") ? [{ id: "delete", label: "Delete user", destructive: true, disabled: !!block, hint: block ?? undefined, onSelect: () => setPending({ kind: "one", action: "delete", user: u }) }] : []),
              ]} />
            </>;
          }} />
      </Panel>
      {pending && <UsersActionDialog pending={pending} role={role} onRole={setRole} roles={roles} onClose={() => setPending(null)} onConfirm={confirm} />}
    </div>
  );
}
