"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BlockedButton, ConfirmActionDialog, Failure, Notice, Panel } from "@starterkit/ui/ds";
import { formatNumber, plural } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { KeyIcon } from "@starterkit/ui/ui/icons";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { toast } from "@starterkit/ui/ui/sonner";
import { PageHeader } from "@/components/shell/page-header";
import { api } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { RoleDto } from "@/lib/shared/contracts/rbac";
import { PERMISSIONS, type PermissionName } from "@/lib/shared/permissions";
import { diff } from "./matrix";
import { PermissionMatrix } from "./permission-matrix";
import { assertRoleName, deleteBlock, RoleNameField } from "./role-name";
import { useAfterRbacChange, useRole } from "./use-rbac";

type Dialog = "save" | "rename" | "delete" | null;

const list = (ps: readonly PermissionName[]) => ps.join(", ");

export function RoleDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const router = useRouter();
  const q = useRole(id);
  const changed = useAfterRbacChange();
  /** Unsaved matrix edits; null = showing the saved permissions. */
  const [draft, setDraft] = useState<ReadonlySet<PermissionName> | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");

  if (q.error && !q.data) return <div className="grid gap-section"><PageHeader title="Role" /><Panel><Failure title="Couldn't load this role" error={q.error} source="Starterkit" onRetry={() => void q.refetch()} /></Panel></div>;
  const r = q.data;
  if (!r) return <div className="grid gap-section" aria-busy="true"><PageHeader title="Role" /><Skeleton className="h-60 w-full" /></div>;

  const saved = new Set(r.permissions);
  const value = draft ?? saved;
  const { added, removed } = diff(saved, value);
  const dirty = added.length + removed.length > 0;
  const readOnly = r.locked
    ? "Superadmin always holds every permission, so this matrix can't be changed."
    : !can("role.edit") ? "You can view this role. Changing it needs the role edit permission." : null;
  const editBlock = r.locked ? "The Superadmin role can't be renamed." : null;

  async function save() {
    const next = await api<RoleDto>(`/api/roles/${id}`, { method: "PATCH", body: JSON.stringify({ permissions: [...value] }) });
    toast(`Saved permissions for ${next.name}.`);
    setDraft(null);
    await changed();
  }
  async function rename() {
    assertRoleName(name);
    const next = await api<RoleDto>(`/api/roles/${id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
    toast(`Renamed to ${next.name}.`);
    await changed();
  }
  async function remove(role: RoleDto) {
    await api(`/api/roles/${id}`, { method: "DELETE" });
    toast(`Deleted ${role.name}.`);
    await changed();
    router.push("/roles");
  }

  return (
    <div className="grid gap-section">
      <PageHeader title={r.name}
        description={`${plural(r.userCount, "user", "users")} · ${formatNumber(r.permissions.length)} of ${formatNumber(PERMISSIONS.length)} permissions${r.locked ? " · Locked" : ""}`}
        actions={<>
          {can("user.view") && r.userCount > 0 && <Button asChild variant="secondary"><Link href={`/users?role=${encodeURIComponent(r.name)}`}>View users</Link></Button>}
          {can("role.edit") && <BlockedButton variant="secondary" reason={editBlock} onClick={() => { setName(r.name); setDialog("rename"); }}>Rename role</BlockedButton>}
          {can("role.delete") && <BlockedButton variant="destructive" reason={deleteBlock(r)} onClick={() => setDialog("delete")}>Delete role</BlockedButton>}
        </>} />
      {q.error && <Notice tone="warn" live>Couldn&apos;t refresh this role; showing the last loaded permissions.</Notice>}
      <Panel flush icon={KeyIcon} title="Permissions" description="Header checkboxes switch a whole module, an action in every module, or everything"
        actions={!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <span role="status" className="text-caption text-fg-2">{dirty ? `${formatNumber(added.length)} to add, ${formatNumber(removed.length)} to remove` : "Change a permission to save."}</span>
            {dirty && <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Discard changes</Button>}
            <Button size="sm" disabled={!dirty} onClick={() => setDialog("save")}>Save permissions</Button>
          </div>
        )}>
        {readOnly && <div className="px-3 pt-3"><Notice>{readOnly}</Notice></div>}
        <PermissionMatrix label={`Permissions of ${r.name}`} value={value} onChange={readOnly ? undefined : setDraft} />
      </Panel>

      {dialog === "save" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} title={`Save permissions for ${r.name}`}
          description={`${plural(added.length, "permission", "permissions")} added, ${plural(removed.length, "permission", "permissions")} removed.`}
          impact={[
            ...(added.length ? [`Adds ${list(added)}`] : []),
            ...(removed.length ? [`Removes ${list(removed)}`] : []),
            `${plural(r.userCount, "user gets", "users get")} the change on their next request.`,
          ]}
          actionLabel="Save permissions" onConfirm={save} />
      )}
      {dialog === "rename" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} title={`Rename ${r.name}`}
          description="Users with this role keep it under the new name." impact={[]} actionLabel="Rename role"
          lead={<RoleNameField value={name} onChange={setName} />} onConfirm={rename} />
      )}
      {dialog === "delete" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} destructive title={`Delete ${r.name}`}
          description="No user has this role." impact={["The role and its permission set are removed.", "This can't be undone."]} actionLabel="Delete role"
          onConfirm={() => remove(r)} />
      )}
    </div>
  );
}
