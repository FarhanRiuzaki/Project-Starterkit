import type { Metadata } from "next";
import { EditProject } from "@/features/projects/project-form";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Edit project");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("project.edit");
  const { id } = await params;
  return <Prefetch reads={[reads.project(id)]}><EditProject id={id} /></Prefetch>;
}
