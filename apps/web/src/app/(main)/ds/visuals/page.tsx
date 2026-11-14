import type { Metadata } from "next";
import { DsVisuals } from "@/features/ds/pages/visuals";

export const metadata: Metadata = { title: "Illustrations" };

export default function IllustrationsPage() {
  return <DsVisuals />;
}
