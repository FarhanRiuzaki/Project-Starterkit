import type { Metadata } from "next";
import { UserDetail } from "@/features/users/user-detail";
import { requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads, type SearchParams, toSearch } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "User · Starterkit" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requirePagePermission("user.view");
  const { id } = await params;
  // The user, their sessions table and the Superadmin check in one server pass (no detail → sessions waterfall).
  return (
    <Prefetch reads={[reads.user(id), reads.userSessions(id, toSearch(await searchParams)), reads.superadmins()]}>
      <UserDetail id={id} />
    </Prefetch>
  );
}
