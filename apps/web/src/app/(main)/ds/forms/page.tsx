import type { Metadata } from "next";
import { DsForms } from "@/features/ds/pages/forms";

export const metadata: Metadata = { title: "Forms" };

export default function FormsPage() {
  return <DsForms />;
}
