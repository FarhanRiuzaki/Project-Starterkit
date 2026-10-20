import type { Metadata } from "next";
import { SecurityPage } from "@/features/me/security-panel";
import { oauthProviders } from "@/lib/server/oauth";
import { Prefetch, reads } from "@/lib/server/prefetch";

export const metadata: Metadata = { title: "Security" };

export default async function Page() {
  return <Prefetch reads={[reads.me()]}><SecurityPage providers={await oauthProviders()} /></Prefetch>;
}
