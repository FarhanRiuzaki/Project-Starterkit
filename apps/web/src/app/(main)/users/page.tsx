import type { Metadata } from "next";
import { UsersPage } from "@/features/users/users-page";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Users");

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("user.view");
  const sp = toSearch(await searchParams);
  return <Prefetch reads={[reads.users(sp), reads.roleOptions(), reads.superadmins()]}><UsersPage /></Prefetch>;
}
