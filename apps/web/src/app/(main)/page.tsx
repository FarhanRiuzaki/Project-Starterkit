import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Dashboard · Starterkit" };

/** Placeholder until the dashboard feature (Task 12) replaces it. */
export default function DashboardPage() {
  return <PageHeader title="Dashboard" description="Overview of users, roles and recent activity." />;
}
