import type { Metadata } from "next";
import { PermissionsPage } from "@/features/rbac/permissions-page";
import { requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Permissions · Starterkit" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("permission.view");
  return <Prefetch reads={[reads.permissions(toSearch(await searchParams))]}><PermissionsPage /></Prefetch>;
}
