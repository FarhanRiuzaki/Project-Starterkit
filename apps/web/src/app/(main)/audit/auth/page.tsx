import type { Metadata } from "next";
import { AuthLogPage } from "@/features/audit/auth-log-page";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "Sign-in log · Starterkit" };

export default async function Page() {
  await requirePagePermission("audit.view");
  return <AuthLogPage />;
}
