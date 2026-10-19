import type { Metadata } from "next";
import { PermissionsPage } from "@/features/rbac/permissions-page";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "Permissions · Starterkit" };

export default async function Page() {
  await requirePagePermission("permission.view");
  return <PermissionsPage />;
}
