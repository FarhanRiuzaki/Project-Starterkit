"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { BodyLoading } from "./body-loading";

/** The body loads after hydration in its own chunk: the route's first load is the header alone (ui-standard §5). */
const MotionSection = dynamic(() => import("../motion-section").then((m) => m.MotionSection), { ssr: false, loading: () => <BodyLoading page="motion" /> });

/** /ds/motion: the motion inventory. */
export function DsMotion() {
  return (
    <>
      <PageHeader title="Motion" description="Motion tokens, replayable patterns and the reduced-motion rules." />
      <MotionSection />
    </>
  );
}
