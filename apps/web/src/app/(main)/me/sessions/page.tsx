import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { MeNav } from "@/features/me/me-nav";
import { MySessionsTable } from "@/features/me/my-sessions-table";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Sessions · Starterkit" };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="grid gap-section">
      <PageHeader title="Sessions" description="Where you're signed in. End any session you don't recognize." actions={<MeNav />} />
      <Prefetch reads={[reads.mySessions(toSearch(await searchParams))]}><MySessionsTable /></Prefetch>
    </div>
  );
}
