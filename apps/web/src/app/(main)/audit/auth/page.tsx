import type { Metadata } from "next";
import { AuthLogPage } from "@/features/audit/auth-log-page";
import { requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Sign-in log · Starterkit" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("audit.view");
  return <Prefetch reads={[reads.authLog(toSearch(await searchParams))]}><AuthLogPage /></Prefetch>;
}
