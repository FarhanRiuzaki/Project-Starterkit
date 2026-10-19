import type { Metadata } from "next";
import { AuthLogPage } from "@/features/audit/auth-log-page";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Sign-in log");

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("audit.view");
  return <Prefetch reads={[reads.authLog(toSearch(await searchParams))]}><AuthLogPage /></Prefetch>;
}
