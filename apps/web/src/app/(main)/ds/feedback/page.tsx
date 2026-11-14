import type { Metadata } from "next";
import { DsFeedback } from "@/features/ds/pages/feedback";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return <DsFeedback />;
}
