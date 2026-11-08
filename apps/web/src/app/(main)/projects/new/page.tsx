import type { Metadata } from "next";
import { CreateProject } from "@/features/projects/project-form";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Create project");

export default async function Page() {
  await requirePagePermission("project.create");
  return <Prefetch reads={[]}><CreateProject /></Prefetch>;
}
