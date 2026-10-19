import type { Metadata } from "next";
import { RoleDetail } from "@/features/rbac/role-detail";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "Role · Starterkit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("role.view");
  return <RoleDetail id={(await params).id} />;
}
