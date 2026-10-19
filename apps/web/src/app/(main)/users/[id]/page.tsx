import type { Metadata } from "next";
import { UserDetail } from "@/features/users/user-detail";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "User · Starterkit" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("user.view");
  return <UserDetail id={(await params).id} />;
}
