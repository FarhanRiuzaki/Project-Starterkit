import type { Metadata } from "next";
import { EditUser } from "@/features/users/user-form";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Edit user");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("user.edit");
  const { id } = await params;
  return <Prefetch reads={[reads.user(id), reads.roleOptions()]}><EditUser id={id} /></Prefetch>;
}
