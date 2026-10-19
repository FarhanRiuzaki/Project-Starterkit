import type { Metadata } from "next";
import { CreateUser } from "@/features/users/user-form";
import { guardedTitle, requirePagePermission } from "@/lib/server/page-guard";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const generateMetadata = (): Promise<Metadata> => guardedTitle("Create user");

export default async function Page() {
  await requirePagePermission("user.create");
  return <Prefetch reads={[reads.roleOptions()]}><CreateUser /></Prefetch>;
}
