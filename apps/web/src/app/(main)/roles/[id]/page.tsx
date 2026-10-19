import type { Metadata } from "next";
import { RoleDetail } from "@/features/rbac/role-detail";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Role");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("role.view");
  const { id } = await params;
  return <Prefetch reads={[reads.role(id)]}><RoleDetail id={id} /></Prefetch>;
}
