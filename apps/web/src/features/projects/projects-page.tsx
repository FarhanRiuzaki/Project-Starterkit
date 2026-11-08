"use client";

import { selectionValues } from "@starterkit/shared/filter-selection";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionMenu, type Column, ColumnsMenu, DataTable, FilterLayout, FilterSurface, FilterChecks, FilterSearch, Notice, Panel, RelativeTime, StatusChip, Toolbar, Truncate } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { FolderIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { SavedViewsMenu } from "@/components/saved-views-menu";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useTableQuery } from "@/lib/client/use-table-query";
import type { ProjectDto } from "@starterkit/shared/contracts/projects";
import { PROJECT_STATUSES, type ProjectFilters, PROJECTS } from "@/lib/shared/queries";
import { PROJECT_LEGEND, projectPage, PROJECTS_KEY, projectStatus, projectUrl } from "./use-projects";

/**
 * Opened on click only: the dialog loads then, outside the page's first load (route budget, AGENTS.md §9); the import
 * starts on the first press or focus in the page (intent), so it is there by the time a dialog opens.
 */
const loadDialog = () => import("@starterkit/ui/ds");
const ConfirmActionDialog = dynamic(() => loadDialog().then((m) => m.ConfirmActionDialog), { ssr: false });
const preloadDialog = () => void loadDialog();

const LINK = "font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const STATUS_LABEL = { "": "Any", active: "Active", archived: "Archived" } as const;
const STATUSES = PROJECT_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }));
/** The table names the view it shows (the page header already says "Projects"). */
const VIEW_TITLE: Record<(typeof PROJECT_STATUSES)[number], string> = { "": "All projects", active: "Active projects", archived: "Archived projects" };

const FILTER_DEFAULTS: ProjectFilters = { q: "", status: "" };
const FILTER_FIELDS = [{ key: "q", label: "Search" }, { key: "status", label: "Status", multiple: true, format: (v: string) => STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? v }] as const;

const COLUMNS: Column<ProjectDto>[] = [
  { key: "name", header: "Project", sortable: true, mobile: "title", className: "min-w-48", cell: (p) => (
    <span className="grid min-w-0 max-w-96">
      <Truncate title={p.name}><Link href={projectPage(p.id)} className={LINK}>{p.name}</Link></Truncate>
      {p.description && <span className="truncate text-caption text-fg-3">{p.description}</span>}
    </span>
  ) },
  { key: "status", header: "Status", cell: (p) => { const s = projectStatus(p); return <StatusChip health={s.health} label={s.label} />; } },
  { key: "createdAt", header: "Created", sortable: true, cell: (p) => <RelativeTime at={Date.parse(p.createdAt)} /> },
  { key: "updatedAt", header: "Updated", mobile: "hidden", cell: (p) => <RelativeTime at={Date.parse(p.updatedAt)} /> },
];

export function ProjectsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const t = useTableQuery<ProjectDto, ProjectFilters>(PROJECTS);
  const f = t.state;
  const set = t.set;
  const [deleting, setDeleting] = useState<ProjectDto | null>(null);
  const filtered = f.q !== "" || f.status !== "";

  async function remove(p: ProjectDto) {
    await api(projectUrl(p.id), { method: "DELETE" });
    toast(`Deleted ${p.name}.`);
    await qc.invalidateQueries({ queryKey: PROJECTS_KEY });
  }

  return (
    <div className="grid gap-section" onPointerDown={preloadDialog} onFocus={preloadDialog}>
      <PageHeader title="Projects" description="Every project, with its status and when it last changed."
        actions={can("project.create") ? <Button asChild><Link href="/projects/new">Create project</Link></Button> : undefined} />
      <FilterSurface>
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the projects; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      {t.viewNotRemembered && <Notice>This filter selection works at this URL, but is too long to remember in navigation. Save a named view to reopen it.</Notice>}
      <FilterLayout<ProjectFilters> busy={t.paging.busy} values={{ q: f.q, status: f.status }} defaults={FILTER_DEFAULTS} fields={FILTER_FIELDS}
        onApply={(values, options) => set(values, options)} filters={(draft, patch) => <>
          <FilterSearch label="Search projects" value={draft.q} onChange={q => patch({ q })} placeholder="Project name" />
          <FilterChecks label="Status" value={draft.status} options={STATUSES} onChange={status => patch({ status })} />
        </>}>
      {({ summary }) => <Panel toolbar={<Toolbar end={<><SavedViewsMenu /><ColumnsMenu columns={COLUMNS} hidden={t.hidden} onChange={t.setHidden} /></>}>{null}</Toolbar>}
        flush icon={FolderIcon} title={VIEW_TITLE[(selectionValues(f.status).length === 1 ? selectionValues(f.status)[0] : "") as keyof typeof VIEW_TITLE]} count={t.count} legend={PROJECT_LEGEND}>
        {summary}
        <DataTable label="Projects" rowHeight="identity" columns={COLUMNS} hidden={t.hidden} rows={t.rows} rowKey={(p) => p.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging}
          error={t.loadError ? { title: "Couldn't load projects", cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={filtered
            ? { icon: FolderIcon, title: "No projects match", description: "Change the search or filters, or clear them to see every project." }
            : { icon: FolderIcon, title: "No projects yet", description: "Projects appear here after you create them." }}
          rowActions={(p) => (
            <ActionMenu label={`Actions for ${p.name}`} actions={[
              { id: "open", label: "View project", onSelect: () => router.push(projectPage(p.id)) },
              ...(can("project.edit") ? [{ id: "edit", label: "Edit project", onSelect: () => router.push(`${projectPage(p.id)}/edit`) }] : []),
              ...(can("project.delete") ? [{ id: "delete", label: "Delete project", destructive: true, onSelect: () => setDeleting(p) }] : []),
            ]} />
          )} />
      </Panel>}
      </FilterLayout>
      </FilterSurface>
      {deleting && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDeleting(null); }} auditFields={false} reasons={[]} destructive title={`Delete ${deleting.name}`}
          description={deleting.description ?? "This project has no description."} impact={["The project is removed.", "This can't be undone."]} actionLabel="Delete project"
          onConfirm={() => remove(deleting)} />
      )}
    </div>
  );
}
