import type { Metadata } from "next";
import { DsMotion } from "@/features/ds/pages/motion";

export const metadata: Metadata = { title: "Motion" };

export default function MotionPage() {
  return <DsMotion />;
}
