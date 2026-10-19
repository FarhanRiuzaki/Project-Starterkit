import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { MeNav } from "@/features/me/me-nav";
import { SecurityPanel } from "@/features/me/security-panel";

export const metadata: Metadata = { title: "Security · Starterkit" };

export default function SecurityPage() {
  return (
    <div className="grid gap-section">
      <PageHeader title="Security" description="Password, two-factor authentication and connected accounts." actions={<MeNav />} />
      <SecurityPanel />
    </div>
  );
}
