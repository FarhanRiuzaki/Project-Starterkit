import type { Metadata } from "next";
import { RolesPage } from "@/features/rbac/roles-page";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Roles");

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("role.view");
  return <Prefetch reads={[reads.roles(toSearch(await searchParams))]}><RolesPage /></Prefetch>;
}
