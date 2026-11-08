import type { Metadata } from "next";
import { ProjectsPage } from "@/features/projects/projects-page";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Projects");

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("project.view");
  return <Prefetch reads={[reads.projects(toSearch(await searchParams))]}><ProjectsPage /></Prefetch>;
}
