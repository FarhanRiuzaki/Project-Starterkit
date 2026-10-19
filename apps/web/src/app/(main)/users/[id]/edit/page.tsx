import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { EditUser } from "@/features/users/user-form";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "Edit user · Starterkit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("user.edit");
  return (
    <div className="grid gap-section">
      <PageHeader title="Edit user" description="Change name, sign-in names, roles or status." />
      <EditUser id={(await params).id} />
    </div>
  );
}
