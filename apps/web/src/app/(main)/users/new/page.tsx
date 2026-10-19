import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { UserForm } from "@/features/users/user-form";
import { requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Create user · Starterkit" };

export default async function Page() {
  await requirePagePermission("user.create");
  return (
    <div className="grid gap-section">
      <PageHeader title="Create user" description="Add an account and choose how it signs in." />
      <Prefetch reads={[reads.roleOptions()]}><UserForm /></Prefetch>
    </div>
  );
}
