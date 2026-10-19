import type { Metadata } from "next";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export const metadata: Metadata = { title: "Dashboard · Starterkit" };

/** Any signed-in user (the layout checks the session); audit-derived parts depend on audit.view server-side. */
export default function Page() {
  return <DashboardPage />;
}
