import type { Metadata } from "next";
import { DesignGallery } from "@/features/ds/gallery";

export const metadata: Metadata = { title: "Design system · Starterkit" };

export default function DesignSystemPage() {
  return <DesignGallery />;
}
