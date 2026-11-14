"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { BodyLoading } from "./body-loading";

/** The body loads after hydration in its own chunk: the route's first load is the header alone (ui-standard §5). */
const FeedbackSections = dynamic(() => import("./feedback-body").then((m) => m.FeedbackSections), { ssr: false, loading: () => <BodyLoading page="feedback" /> });

/** /ds/feedback: overlays and toasts. */
export function DsFeedback() {
  return (
    <>
      <PageHeader title="Feedback" description="Dialogs, drawers, popovers, the command palette and toasts." />
      <FeedbackSections />
    </>
  );
}
