import type { Metadata } from "next";
import { ActivityPage } from "@/features/audit/activity-page";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "Activity log · Starterkit" };

export default async function Page() {
  await requirePagePermission("audit.view");
  return <ActivityPage />;
}
