import type { Metadata } from "next";
import { AffectGallery } from "@/features/ds/affect/affect-page";

export const metadata: Metadata = { title: "affectUI components" };

export default function AffectGalleryPage() {
  return <AffectGallery />;
}
