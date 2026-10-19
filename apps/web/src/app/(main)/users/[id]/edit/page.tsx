import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { EditUser } from "@/features/users/user-form";
import { requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Edit user · Starterkit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("user.edit");
  const { id } = await params;
  return (
    <div className="grid gap-section">
      <PageHeader title="Edit user" description="Change name, sign-in names, roles or status." />
      <Prefetch reads={[reads.user(id), reads.roleOptions()]}><EditUser id={id} /></Prefetch>
    </div>
  );
}
