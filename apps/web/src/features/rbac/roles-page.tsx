"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ActionMenu, type Column, ConfirmActionDialog, DataTable, Notice, Panel, QueryInput, Toolbar } from "@starterkit/ui/ds";
import { formatNumber, plural } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { KeyIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/sonner";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useTableQuery } from "@/lib/client/use-table-query";
import type { RoleDto } from "@/lib/shared/contracts/rbac";
import { PERMISSIONS } from "@/lib/shared/permissions";
import { ROLES } from "@/lib/shared/queries";
import { assertRoleName, deleteBlock, RoleNameField } from "./role-name";
import { rolePage, roleUrl, useAfterRbacChange } from "./use-rbac";

const LINK = "font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function RolesPage() {
  const { can } = useAuth();
  const router = useRouter();
  const t = useTableQuery<RoleDto, { q: string }>(ROLES);
  const set = t.set;
  const onSearch = useCallback((q: string) => set({ q }), [set]);
  const changed = useAfterRbacChange();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<RoleDto | null>(null);

  const columns: Column<RoleDto>[] = [
    { key: "name", header: "Role", icon: KeyIcon, sortable: true, cell: (r) => (
      <span className="flex items-center gap-2"><Link href={rolePage(r.id)} className={LINK}>{r.name}</Link>{r.locked && <span className="text-caption text-fg-3">Locked</span>}</span>
    ) },
    { key: "permissions", header: "Permissions", sortable: true, cell: (r) => `${formatNumber(r.permissions.length)} of ${formatNumber(PERMISSIONS.length)}` },
    { key: "users", header: "Users", sortable: true, cell: (r) => (can("user.view") && r.userCount > 0
      ? <Link href={`/users?role=${encodeURIComponent(r.name)}`} className="text-fg hover:underline">{plural(r.userCount, "user", "users")}</Link>
      : plural(r.userCount, "user", "users")) },
  ];

  async function create() {
    assertRoleName(name);
    const role = await api<RoleDto>("/api/roles", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
    toast(`Created ${role.name}. Pick its permissions next.`);
    await changed();
    router.push(rolePage(role.id));
  }

  async function remove(r: RoleDto) {
    await api(roleUrl(r.id), { method: "DELETE" });
    toast(`Deleted ${r.name}.`);
    await changed();
  }

  return (
    <div className="grid gap-section">
      <PageHeader title="Roles" description="Each role is a set of permissions. A user gets the permissions of every role they have."
        actions={can("role.create") ? <Button onClick={() => { setName(""); setCreating(true); }}>Create role</Button> : undefined} />
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the roles; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Toolbar>
        <div className="w-full max-w-80"><QueryInput value={t.state.q} onChange={onSearch} keys={[]} label="Search roles" placeholder="Search role name" /></div>
      </Toolbar>
      <Panel flush icon={KeyIcon} title="Roles" count={t.count}>
        <DataTable label="Roles" columns={columns} rows={t.rows} rowKey={(r) => r.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging}
          error={t.loadError ? { title: "Couldn't load roles", cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={t.state.q
            ? { icon: KeyIcon, title: "No roles match", description: "Change the search, or clear it to see every role." }
            : { icon: KeyIcon, title: "No roles yet", description: "Roles appear here after you create them." }}
          rowActions={(r) => {
            const block = deleteBlock(r);
            return <ActionMenu label={`Actions for ${r.name}`} actions={[
              { id: "open", label: "View role", onSelect: () => router.push(rolePage(r.id)) },
              ...(can("role.delete") ? [{ id: "delete", label: "Delete role", destructive: true, disabled: !!block, hint: block ?? undefined, onSelect: () => setDeleting(r) }] : []),
            ]} />;
          }} />
      </Panel>
      {creating && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setCreating(false); }} auditFields={false} reasons={[]} title="Create role"
          description="The role starts with no permissions; you pick them on the next page." impact={[]} actionLabel="Create role"
          lead={<RoleNameField value={name} onChange={setName} />} onConfirm={create} />
      )}
      {deleting && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDeleting(null); }} auditFields={false} reasons={[]} destructive title={`Delete ${deleting.name}`}
          description="No user has this role." impact={["The role and its permission set are removed.", "This can't be undone."]} actionLabel="Delete role"
          onConfirm={() => remove(deleting)} />
      )}
    </div>
  );
}
