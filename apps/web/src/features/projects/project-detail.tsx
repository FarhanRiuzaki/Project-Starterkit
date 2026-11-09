"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Failure, Notice, Panel, RelativeTime, StatusChip } from "@starterkit/ui/ds";
import { useDelayedFlag } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { FolderIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { DetailNotFound } from "@/components/detail-not-found";
import { LoadingShape } from "@/components/route-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { api, isNotFound } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { BRAND } from "@starterkit/shared/brand";
import { activityHistoryHref } from "@/lib/shared/activity-links";
import { projectDetail } from "@/lib/shared/queries";
import { PROJECT_DETAIL_SHAPE } from "./shapes";
import { PROJECT_LEGEND, projectPage, PROJECTS_KEY, projectStatus, projectUrl, useProjectDetail } from "./use-projects";

/** Opened on click only: the dialog loads then, outside the page's first load (route budget, AGENTS.md §9). */
const ConfirmActionDialog = dynamic(() => import("@starterkit/ui/ds").then((m) => m.ConfirmActionDialog), { ssr: false });

const LIST = { href: "/projects", label: "Projects" };

/** Label / value rows of the details card. */
function Rows({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
          <dt className="w-28 shrink-0 text-label text-fg">{i.label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words text-body-sm text-fg-2">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProjectDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  /** Set once this page deleted the project: stop fetching it (no 404 flash), drop it from the cache when the page goes away. */
  const [deleted, setDeleted] = useState(false);
  const q = useProjectDetail(id, !deleted);
  // No flash: the loading shape appears after 150 ms and then stays at least 300 ms.
  const skeleton = useDelayedFlag(!q.data && !q.error);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => () => { if (deleted) qc.removeQueries({ queryKey: projectDetail(id).key }); }, [deleted, id, qc]);

  if (isNotFound(q.error)) return <DetailNotFound title="Project" noun="project" list={LIST} />;
  if (q.error && !q.data) return <div className="grid gap-section"><PageHeader title="Project" /><Panel><Failure title="Couldn't load this project" error={q.error} source={BRAND.name} onRetry={() => void q.refetch()} /></Panel></div>;
  const p = q.data;
  if (!p || skeleton) return <LoadingShape sections={PROJECT_DETAIL_SHAPE} shown={skeleton} />;
  const s = projectStatus(p);

  async function remove(name: string) {
    await api(projectUrl(id), { method: "DELETE" });
    // Leave first and stop the detail query, so the page never refetches itself into a "doesn't exist" flash.
    setDeleted(true);
    router.push(LIST.href);
    toast(`Deleted ${name}.`);
    await qc.invalidateQueries({ queryKey: PROJECTS_KEY, predicate: (x) => x.queryKey[2] !== id });
  }

  return (
    <div className="grid gap-section">
      <PageHeader title={p.name} status={<StatusChip health={s.health} label={s.label} />} description="A project and its status."
        actions={<>
          {can("project.edit") && <Button asChild variant="secondary"><Link href={`${projectPage(id)}/edit`}>Edit project</Link></Button>}
          {can("audit.view") && <div className="grid gap-1"><Button asChild variant="secondary"><Link href={activityHistoryHref("project", p.id)}>View history</Link></Button><span className="text-caption text-fg-3">Activity · Last 90 days</span></div>}
        </>}
        more={can("project.delete") ? [{ label: "Delete project", destructive: true, onSelect: () => setDeleting(true) }] : []} />
      {q.error && <Notice tone="warn" live>Couldn&apos;t refresh this project; showing the last loaded details.</Notice>}
      <Panel icon={FolderIcon} title="Details" description="Project facts" legend={PROJECT_LEGEND}>
        <Rows items={[
          { label: "Status", value: <StatusChip health={s.health} label={s.label} /> },
          { label: "Description", value: p.description ?? "–" },
          { label: "Created", value: <RelativeTime at={Date.parse(p.createdAt)} /> },
          { label: "Updated", value: <RelativeTime at={Date.parse(p.updatedAt)} /> },
        ]} />
      </Panel>
      {deleting && (
        <ConfirmActionDialog open onOpenChange={(o) => { if (!o) setDeleting(false); }} auditFields={false} reasons={[]} destructive title={`Delete ${p.name}`}
          description={p.description ?? "This project has no description."} impact={["The project is removed.", "This can't be undone."]} actionLabel="Delete project"
          onConfirm={() => remove(p.name)} />
      )}
    </div>
  );
}
