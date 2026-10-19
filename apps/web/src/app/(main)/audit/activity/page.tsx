import type { Metadata } from "next";
import { ActivityPage } from "@/features/audit/activity-page";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Activity log");

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("audit.view");
  return <Prefetch reads={[reads.activity(toSearch(await searchParams))]}><ActivityPage /></Prefetch>;
}
