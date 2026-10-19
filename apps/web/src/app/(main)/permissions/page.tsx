import type { Metadata } from "next";
import { PermissionsPage } from "@/features/rbac/permissions-page";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Permissions");

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("permission.view");
  return <Prefetch reads={[reads.permissions(toSearch(await searchParams))]}><PermissionsPage /></Prefetch>;
}
