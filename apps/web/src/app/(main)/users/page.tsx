import type { Metadata } from "next";
import { UsersPage } from "@/features/users/users-page";
import { requirePagePermission } from "@/lib/server/page-guard";

export const metadata: Metadata = { title: "Users · Starterkit" };

export default async function Page() {
  await requirePagePermission("user.view");
  return <UsersPage />;
}
