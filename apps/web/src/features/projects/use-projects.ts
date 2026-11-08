import { useQuery } from "@tanstack/react-query";
import type { Health } from "@starterkit/ui/lib/status";
import { api, retryUnlessNotFound } from "@/lib/client/api";
import type { ProjectDto } from "@starterkit/shared/contracts/projects";
import { projectDetail, PROJECTS_KEY } from "@/lib/shared/queries";

export { PROJECTS_KEY };

export const projectPage = (id: string) => `/projects/${encodeURIComponent(id)}`;
export const projectUrl = (id: string) => projectDetail(id).url;

/** A 404 is final (no retry); `enabled: false` once the project is deleted from its own page. */
export function useProjectDetail(id: string, enabled = true) {
  const { key, url } = projectDetail(id);
  return useQuery({ queryKey: key, queryFn: () => api<ProjectDto>(url), enabled, retry: retryUnlessNotFound });
}

/** One mapping for the status chip on every project screen: archived = put away on purpose (stopped). */
export const projectStatus = (p: Pick<ProjectDto, "status">): { health: Health; label: "Active" | "Archived" } =>
  p.status === "active" ? { health: "healthy", label: "Active" } : { health: "stopped", label: "Archived" };

/** The status legend of every card that shows project statuses. */
export const PROJECT_LEGEND = [
  { health: "healthy" as const, label: "Active", description: "In use." },
  { health: "stopped" as const, label: "Archived", description: "Put away on purpose. Edit the project to make it active again." },
];
