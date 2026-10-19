import type { Metadata } from "next";
import { ProfilePage } from "@/features/me/profile-form";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <Prefetch reads={[reads.me()]}><ProfilePage /></Prefetch>;
}
