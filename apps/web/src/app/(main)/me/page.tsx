import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { MeNav } from "@/features/me/me-nav";
import { ProfileForm } from "@/features/me/profile-form";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Profile · Starterkit" };

export default function ProfilePage() {
  return (
    <div className="grid gap-section">
      <PageHeader title="Profile" description="Your name and email." actions={<MeNav />} />
      <Prefetch reads={[reads.me()]}><ProfileForm /></Prefetch>
    </div>
  );
}
