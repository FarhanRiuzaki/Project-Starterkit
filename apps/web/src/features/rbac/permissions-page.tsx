"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { type Column, DataTable, Field, FilterMenu, Notice, Panel, QueryInput, Toolbar, ToolbarFilters } from "@starterkit/ui/ds";
import { plural } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { SecureIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { Select } from "@starterkit/ui/ui/select";
import { toast } from "@starterkit/ui/ui/toast";
import { RoleChips } from "@/components/role-chips";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useTableQuery } from "@/lib/client/use-table-query";
import type { CreatePermissionsResult, PermissionDto } from "@starterkit/shared/contracts/rbac";
import { MODULES, PERMISSION_KEY, permissionLabel } from "@starterkit/shared/permissions";
import { PERMISSION_MODULES, PERMISSIONS_TABLE } from "@/lib/shared/queries";
import { useAfterRbacChange } from "./use-rbac";

/**
 * Opened on click only: the dialog loads then, outside the page's first load (route budget, AGENTS.md §9); the import
 * starts on the first press or focus in the page (intent), so it is there by the time a dialog opens.
 */
const loadDialog = () => import("@starterkit/ui/ds");
const ConfirmActionDialog = dynamic(() => loadDialog().then((m) => m.ConfirmActionDialog), { ssr: false });
const preloadDialog = () => void loadDialog();

const MODULE_OPTIONS = PERMISSION_MODULES.map((m) => ({ value: m, label: m ? permissionLabel(m) : "Any" }));
type Filters = { q: string; module: string };

/** Phone card: the name is the title (it already says module and action), the roles a line under it. */
const COLUMNS: Column<PermissionDto>[] = [
  { key: "name", header: "Permission", icon: SecureIcon, sortable: true, mobile: "title", cell: (p) => <span className="font-mono text-mono text-fg">{p.name}</span> },
  { key: "module", header: "Module", sortable: true, mobile: "hidden", cell: (p) => permissionLabel(p.name.split(".")[0]!) },
  { key: "action", header: "Action", sortable: true, mobile: "hidden", cell: (p) => permissionLabel(p.name.split(".")[1]!) },
  { key: "roles", header: "Roles", cell: (p) => <RoleChips roles={p.roles} total={p.roleCount} /> },
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
  const t = useTableQuery<PermissionDto, Filters>(PERMISSIONS_TABLE);
  const f = t.state;
  const set = t.set;
  const onSearch = useCallback((q: string) => set({ q }), [set]);
  const filtered = f.q !== "" || f.module !== "";
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
    <div className="grid gap-section" onPointerDown={preloadDialog} onFocus={preloadDialog}>
      <PageHeader title="Permissions" description="Everything a role can allow. Roles decide who has each permission."
        actions={can("permission.create") ? <Button onClick={() => { setActions(""); setAdding(true); }}>Add permissions</Button> : undefined} />
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the permissions; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Toolbar>
        <div className="w-full max-w-80 max-md:max-w-none"><QueryInput value={f.q} onChange={onSearch} keys={[]} label="Search permissions" placeholder="Search permission name" /></div>
        <ToolbarFilters active={f.module ? 1 : 0}>
          <FilterMenu label="Module" value={f.module} options={MODULE_OPTIONS} onChange={(module) => set({ module })} />
          {filtered && <Button variant="ghost" size="sm" onClick={() => set({ q: "", module: "" })}>Clear filters</Button>}
        </ToolbarFilters>
      </Toolbar>
      <Panel flush icon={SecureIcon} title="Permissions" count={t.count} description="Grant them to roles on each role's page">
        <DataTable label="Permissions" columns={COLUMNS} rows={t.rows} rowKey={(p) => p.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging}
          error={t.loadError ? { title: "Couldn't load permissions", cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={filtered
            ? { icon: SecureIcon, title: "No permissions match", description: "Change the search or module, or clear them to see every permission." }
            : { icon: SecureIcon, title: "No permissions yet", description: "Permissions appear here after they are added." }} />
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
