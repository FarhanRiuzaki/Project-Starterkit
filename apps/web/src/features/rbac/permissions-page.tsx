"use client";

import { useState } from "react";
import { type Column, ConfirmActionDialog, DataTable, Field, Notice, Panel } from "@starterkit/ui/ds";
import { plural } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { SecureIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { Select } from "@starterkit/ui/ui/select";
import { toast } from "@starterkit/ui/ui/sonner";
import { RoleChips } from "@/components/role-chips";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { CreatePermissionsResult, PermissionDto } from "@/lib/shared/contracts/rbac";
import { MODULES, PERMISSION_KEY, permissionLabel } from "@/lib/shared/permissions";
import { usePermissions, useAfterRbacChange } from "./use-rbac";

const COLUMNS: Column<PermissionDto>[] = [
  { key: "name", header: "Permission", icon: SecureIcon, cell: (p) => <span className="font-mono text-mono text-fg">{p.name}</span> },
  { key: "module", header: "Module", cell: (p) => permissionLabel(p.name.split(".")[0]!) },
  { key: "action", header: "Action", cell: (p) => permissionLabel(p.name.split(".")[1]!) },
  { key: "roles", header: "Roles", cell: (p) => <RoleChips roles={p.roles} /> },
];

/** Comma- or space-separated actions → `<module>.<action>` names; throws the message the dialog shows. */
function namesOf(module: string, actions: string): string[] {
  const names = actions.split(/[\s,]+/).filter(Boolean).map((a) => `${module}.${a.toLowerCase()}`);
  if (names.length === 0) throw new Error("Enter at least one action, for example export.");
  const bad = names.find((n) => !PERMISSION_KEY.test(n));
  if (bad) throw new Error(`"${bad.split(".")[1]}" isn't a valid action. Use lowercase letters, digits or underscores, starting with a letter.`);
  return names;
}

export function PermissionsPage() {
  const { can } = useAuth();
  const q = usePermissions();
  const changed = useAfterRbacChange();
  const [adding, setAdding] = useState(false);
  const [module, setModule] = useState<string>(MODULES[0]!.key);
  const [actions, setActions] = useState("");

  async function add() {
    const r = await api<CreatePermissionsResult>("/api/permissions", { method: "POST", body: JSON.stringify({ names: namesOf(module, actions) }) });
    toast(`${plural(r.created.length, "permission", "permissions")} added`, { description: r.skipped.length ? `Already in the list: ${r.skipped.join(", ")}.` : undefined });
    await changed();
  }

  return (
    <div className="grid gap-section">
      <PageHeader title="Permissions" description="Everything a role can allow. Roles decide who has each permission."
        actions={can("permission.create") ? <Button onClick={() => { setActions(""); setAdding(true); }}>Add permissions</Button> : undefined} />
      {q.error && q.data && <Notice tone="warn" live>Couldn&apos;t refresh the permissions; showing the last loaded list.</Notice>}
      <Panel flush icon={SecureIcon} title="Permissions" count={q.data?.length} description="Grant them to roles on each role's page">
        <DataTable label="Permissions" columns={COLUMNS} rows={q.data ?? []} rowKey={(p) => p.name} loading={q.isPending}
          error={q.error && !q.data ? { title: "Couldn't load permissions", cause: errorText(q.error), onRetry: () => void q.refetch() } : null}
          empty={{ icon: SecureIcon, title: "No permissions yet", description: "Permissions appear here after they are added." }} />
      </Panel>
      {adding && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setAdding(false); }} auditFields={false} reasons={[]} title="Add permissions"
          description="Each name is the module and an action, for example audit.export."
          impact={["The new names appear in this list.", "Roles can't hold them yet: the matrix shows the actions this app defines."]}
          actionLabel="Add permissions" onConfirm={add}
          lead={<>
            <Field id="perm-module" label="Module">
              <Select id="perm-module" value={module} onChange={(e) => setModule(e.target.value)}>
                {MODULES.map((m) => <option key={m.key} value={m.key}>{permissionLabel(m.key)}</option>)}
              </Select>
            </Field>
            <Field id="perm-actions" label="Actions" note="Separate several with commas. Names already in the list are skipped.">
              <Input id="perm-actions" value={actions} maxLength={300} autoComplete="off" className="font-mono" onChange={(e) => setActions(e.target.value)} />
            </Field>
          </>} />
      )}
    </div>
  );
}
