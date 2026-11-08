"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { ErrorSummary, Failure, Field, FormActions, Notice, Panel, RadioGroup, RequiredNote, useForm } from "@starterkit/ui/ds";
import { rules, type Rule, type Schema } from "@starterkit/ui/lib/validate";
import { useDelayedFlag } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { Textarea } from "@starterkit/ui/ui/textarea";
import { toast } from "@starterkit/ui/ui/toast";
import { DetailNotFound } from "@/components/detail-not-found";
import { LazyConfirmActionDialog } from "@/components/lazy-confirm";
import { LoadingShape } from "@/components/route-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { ApiError, api, errorText, isNotFound } from "@/lib/client/api";
import { useLeaveGuard } from "@/lib/client/use-leave-guard";
import { BRAND } from "@starterkit/shared/brand";
import type { ProjectDto } from "@starterkit/shared/contracts/projects";
import { PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX, type ProjectStatus } from "@starterkit/shared/projects";
import { PROJECT_FORM_SHAPE } from "./shapes";
import { projectPage, PROJECTS_KEY, projectUrl, useProjectDetail } from "./use-projects";

const CREATE = { title: "Create project", description: "Name the project and say what it is for." };
const EDIT = { title: "Edit project", description: "Change the name, description or status." };

type Values = { name: string; description: string; status: ProjectStatus };
const trimmedMax = (limit: number): Rule => (value, values) => rules.maxLength(limit)(typeof value === "string" ? value.trim() : value, values);
const SCHEMA: Schema<Values> = {
  name: [rules.required("Enter a project name."), trimmedMax(PROJECT_NAME_MAX)],
  description: [trimmedMax(PROJECT_DESCRIPTION_MAX)],
};
const LABELS = { name: "Name", description: "Description" };

/** /projects/new: the page header and an empty form. */
export function CreateProject() {
  return <div className="grid gap-section"><PageHeader {...CREATE} /><ProjectForm /></div>;
}

/** Create (no `project`) or edit one project: one group of fields, so no FormSection (design-system §5.16). */
function ProjectForm({ project }: { project?: ProjectDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const initial: Values = { name: project?.name ?? "", description: project?.description ?? "", status: project?.status ?? "active" };
  const f = useForm<Values>({ initial, schema: SCHEMA, idPrefix: "p" });
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ name: string; message: string } | null>(null);
  const nameError = duplicate?.name === f.values.name.trim() ? duplicate.message : undefined;
  const shown = { ...f.shown, ...(nameError ? { name: nameError } : {}) };
  // Typed but not saved: a link click asks first (while saving, the form navigates away itself).
  const dirty = f.values.name !== initial.name || f.values.description !== initial.description || f.values.status !== initial.status;
  const guard = useLeaveGuard(dirty && !busy);

  const save = (event: FormEvent<HTMLFormElement>) => f.submit(async (v) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setDuplicate(null);
    const body = JSON.stringify({ name: v.name.trim(), description: v.description.trim(), status: v.status });
    try {
      const saved = project
        ? await api<ProjectDto>(projectUrl(project.id), { method: "PATCH", body })
        : await api<ProjectDto>("/api/projects", { method: "POST", body });
      toast(project ? `Saved ${saved.name}.` : `Created ${saved.name}.`);
      await qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      router.push(projectPage(saved.id));
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate") {
        setDuplicate({ name: v.name.trim(), message: errorText(err) });
        requestAnimationFrame(() => document.getElementById(f.id("name"))?.focus());
      } else setError(errorText(err));
      saving.current = false;
      setBusy(false);
    }
  })(event);

  return (
    <Panel bodyClassName="md:p-6">
      <form noValidate onSubmit={save} aria-label={project ? "Edit project" : "New project"} className="grid max-w-xl gap-4">
        {f.submitted && <ErrorSummary errors={shown} idPrefix="p" labels={LABELS} />}
        <fieldset disabled={busy} className="contents">
        <RequiredNote />
        <Field id={f.id("name")} label="Name" required note="Unique across all projects, ignoring letter case." error={f.error("name") ?? nameError}>
          <Input {...f.text("name")} autoComplete="off" />
        </Field>
        <Field id={f.id("description")} label="Description" optional error={f.error("description")}>
          <Textarea {...f.text("description")} limit={PROJECT_DESCRIPTION_MAX} countValue={f.values.description.trim()} />
        </Field>
        <RadioGroup name="p-status" legend="Status" required value={f.values.status} onChange={(s) => f.set("status", s)} options={[
          { value: "active", label: "Active", description: "In use." },
          { value: "archived", label: "Archived", description: "Put away. It can be made active again later." },
        ]} />
        {error && <p role="alert" className="text-body-sm text-down-ink">{error}</p>}
        <FormActions className="md:-mx-6 md:-mb-6 md:px-6">
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>{busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}{project ? "Save project" : "Create project"}</Button>
          {busy ? <Button type="button" variant="ghost" disabled>Cancel</Button>
            : <Button asChild variant="ghost"><Link href={project ? projectPage(project.id) : "/projects"}>Cancel</Link></Button>}
        </FormActions>
        </fieldset>
      </form>
      {guard.leaving && (
        <LazyConfirmActionDialog open onOpenChange={(o) => { if (!o) guard.stay(); }} auditFields={false} reasons={[]} destructive title="Leave without saving"
          onCloseAutoFocus={e => { e.preventDefault(); guard.restoreFocus(); }}
          description={project ? `Your changes to ${project.name} aren't saved.` : "This project isn't created yet."}
          impact={["What you typed is discarded."]} actionLabel="Leave page" onConfirm={async () => guard.leave()} />
      )}
    </Panel>
  );
}

/** /projects/[id]/edit: loads the project, then shows the form (keyed so it starts from the loaded values). */
export function EditProject({ id }: { id: string }) {
  const q = useProjectDetail(id);
  const skeleton = useDelayedFlag(!q.data && !q.error);
  const refreshing = useDelayedFlag(q.isFetching && !!q.data);
  if (isNotFound(q.error)) return <DetailNotFound title={EDIT.title} noun="project" list={{ href: "/projects", label: "Projects" }} />;
  if (q.error && !q.data) return <div className="grid gap-section"><PageHeader {...EDIT} /><Panel><Failure title="Couldn't load this project" error={q.error} source={BRAND.name} onRetry={() => void q.refetch()} /></Panel></div>;
  if (!q.data || skeleton) return <LoadingShape sections={PROJECT_FORM_SHAPE} shown={skeleton} />;
  return <div className="grid gap-section">
    <PageHeader {...EDIT} trail={[{ label: q.data.name, href: projectPage(q.data.id) }]} />
    {q.error && <Notice tone="warn" live>
      Couldn&apos;t refresh this project; showing the last loaded details.
      <Button type="button" variant="link" size="sm" className="ml-2" disabled={q.isFetching} aria-busy={refreshing || undefined} onClick={() => void q.refetch()}>
        {refreshing && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Retry refresh
      </Button>
    </Notice>}
    <ProjectForm key={q.data.id} project={q.data} />
  </div>;
}
