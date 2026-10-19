"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlockedButton, ConfirmActionDialog, EmptyState, Failure, Notice, Panel } from "@starterkit/ui/ds";
import { useDelayedFlag } from "@starterkit/ui/motion";
import { formatNumber, plural } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { KeyIcon, NotFoundIcon } from "@starterkit/ui/ui/icons";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { toast } from "@starterkit/ui/ui/toast";
import { PageHeader } from "@/components/shell/page-header";
import { api } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { RoleDto } from "@/lib/shared/contracts/rbac";
import { PERMISSIONS, type PermissionName } from "@/lib/shared/permissions";
import { applyEdit, type Draft, withDraft } from "./matrix";
import { PermissionMatrix } from "./permission-matrix";
import { assertRoleName, deleteBlock, RoleNameField } from "./role-name";
import { isNotFound, roleKey, roleUrl, useAfterRbacChange, useRole } from "./use-rbac";

type Dialog = "save" | "rename" | "delete" | null;

const list = (ps: readonly PermissionName[]) => ps.join(", ");

export function RoleDetail({ id }: { id: string }) {
  const { can, perms } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  /** Set once this page deleted the role: stop fetching it, drop it from the cache when the page goes away. */
  const [deleted, setDeleted] = useState(false);
  const q = useRole(id, !deleted);
  // No flash: the loading shape appears after 150 ms and then stays at least 300 ms (it holds its place hidden before).
  const skeleton = useDelayedFlag(!q.data && !q.error);
  const changed = useAfterRbacChange();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  useEffect(() => () => { if (deleted) qc.removeQueries({ queryKey: roleKey(id) }); }, [deleted, id, qc]);

  if (isNotFound(q.error)) {
    return (
      <div className="grid gap-section"><PageHeader title="Role" />
        <Panel><EmptyState icon={NotFoundIcon} title="This role doesn't exist" description="It may have been deleted. Roles that exist are listed on the Roles page."
          action={<Button asChild variant="secondary"><Link href="/roles">Go to roles</Link></Button>} /></Panel>
      </div>
    );
  }
  if (q.error && !q.data) return <div className="grid gap-section"><PageHeader title="Role" /><Panel><Failure title="Couldn't load this role" error={q.error} source="Starterkit" onRetry={() => void q.refetch()} /></Panel></div>;
  const r = q.data;
  if (!r || skeleton) return <div className={skeleton ? "grid gap-section" : "invisible grid gap-section"} aria-busy={skeleton || undefined}><PageHeader title="Role" /><Skeleton className="h-60 w-full" /></div>;

  const saved = new Set(r.permissions);
  // Unsaved edits as add / remove: the matrix shows the server's current set with them applied, and Save sends only
  // them, so a change someone else made meanwhile is neither shown as an edit nor undone.
  const { added, removed } = draft ?? { added: [], removed: [] };
  const value = withDraft(saved, draft);
  const dirty = added.length + removed.length > 0;
  const readOnly = r.locked
    ? "Superadmin always holds every permission, so this matrix can't be changed."
    : !can("role.edit") ? "You can view this role. Changing it needs the role edit permission." : null;
  const editBlock = r.locked ? "The Superadmin role can't be renamed." : null;

  async function save() {
    const next = await api<RoleDto>(roleUrl(id), { method: "PATCH", body: JSON.stringify({ add: added, remove: removed }) });
    qc.setQueryData(roleKey(id), next);
    setDraft(null);
    toast(`Saved permissions for ${next.name}.`);
    await changed();
  }
  async function rename() {
    assertRoleName(name);
    const next = await api<RoleDto>(roleUrl(id), { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
    qc.setQueryData(roleKey(id), next);
    toast(`Renamed to ${next.name}.`);
    await changed();
  }
  async function remove(role: RoleDto) {
    await api(roleUrl(id), { method: "DELETE" });
    setDeleted(true);
    toast(`Deleted ${role.name}.`);
    router.push("/roles");
    await changed(roleKey(id));
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
        <PermissionMatrix label={`Permissions of ${r.name}`} value={value} allowed={perms}
          onChange={readOnly ? undefined : (edit) => setDraft((d) => applyEdit(saved, d, edit))} />
      </Panel>

      {dialog === "save" && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} auditFields={false} reasons={[]} title={`Save permissions for ${r.name}`}
          description={`${plural(added.length, "permission", "permissions")} added, ${plural(removed.length, "permission", "permissions")} removed.`}
          impact={[
            ...(added.length ? [`Adds ${list(added)}`] : []),
            ...(removed.length ? [`Removes ${list(removed)}`] : []),
            "Other permissions of this role stay as they are now, including changes someone else made after you opened this page.",
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
