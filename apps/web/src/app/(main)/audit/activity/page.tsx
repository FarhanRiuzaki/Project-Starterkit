import type { Metadata } from "next";
import { ActivityPage } from "@/features/audit/activity-page";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Activity log");

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("audit.view");
  const search = toSearch(await searchParams);
  return <Prefetch reads={[reads.activity(search), ...(search.has("entry") ? [reads.activityEntry(search.get("entry") ?? "")] : [])]}><ActivityPage /></Prefetch>;
}
