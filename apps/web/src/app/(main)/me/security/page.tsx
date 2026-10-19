import type { Metadata } from "next";
import { SecurityPage } from "@/features/me/security-panel";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <Prefetch reads={[reads.me()]}><SecurityPage /></Prefetch>;
}
