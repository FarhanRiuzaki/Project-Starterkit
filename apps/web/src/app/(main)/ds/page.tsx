import type { Metadata } from "next";
import { DsOverview } from "@/features/ds/pages/overview";

export const metadata: Metadata = { title: "Design system" };

export default function DesignSystemPage() {
  return <DsOverview />;
}
