import type { Metadata } from "next";
import { DsData } from "@/features/ds/pages/data";

export const metadata: Metadata = { title: "Data display" };

export default function DataDisplayPage() {
  return <DsData />;
}
