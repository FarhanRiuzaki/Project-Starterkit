import type { Metadata } from "next";
import { ProjectDetail } from "@/features/projects/project-detail";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Project");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("project.view");
  const { id } = await params;
  return <Prefetch reads={[reads.project(id)]}><ProjectDetail id={id} /></Prefetch>;
}
