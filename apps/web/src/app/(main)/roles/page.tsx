import type { Metadata } from "next";
import { RolesPage } from "@/features/rbac/roles-page";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "Roles · Starterkit" };

export default async function Page() {
  await requirePagePermission("role.view");
  return <RolesPage />;
}
