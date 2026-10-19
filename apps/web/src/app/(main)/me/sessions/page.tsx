import type { Metadata } from "next";
import { MySessionsPage } from "@/features/me/my-sessions-table";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Sessions" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <Prefetch reads={[reads.mySessions(toSearch(await searchParams))]}><MySessionsPage /></Prefetch>;
}
