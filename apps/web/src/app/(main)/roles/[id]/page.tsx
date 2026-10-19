import type { Metadata } from "next";
import { RoleDetail } from "@/features/rbac/role-detail";
import { requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Role · Starterkit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("role.view");
  const { id } = await params;
  return <Prefetch reads={[reads.role(id)]}><RoleDetail id={id} /></Prefetch>;
}
