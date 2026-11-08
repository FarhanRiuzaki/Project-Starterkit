import type { Metadata } from "next";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { Prefetch, reads, toSearch, type SearchParams } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Dashboard" };

/** Any signed-in user (the layout checks the session); audit-derived parts depend on audit.view server-side. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <Prefetch reads={[reads.dashboard(toSearch(await searchParams))]}><DashboardPage /></Prefetch>;
}
