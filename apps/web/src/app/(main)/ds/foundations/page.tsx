import type { Metadata } from "next";
import { DsFoundations } from "@/features/ds/pages/foundations";

export const metadata: Metadata = { title: "Foundations" };

export default function FoundationsPage() {
  return <DsFoundations />;
}
