import type { Metadata } from "next";
import { DsComponents } from "@/features/ds/pages/components";

export const metadata: Metadata = { title: "Components" };

export default function ComponentsPage() {
  return <DsComponents />;
}
