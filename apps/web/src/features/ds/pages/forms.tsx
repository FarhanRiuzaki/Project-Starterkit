"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { BodyLoading } from "./body-loading";

/** The body loads after hydration in its own chunk: the route's first load is the header alone (ui-standard §5). */
const FormsSections = dynamic(() => import("./forms-body").then((m) => m.FormsSections), { ssr: false, loading: () => <BodyLoading page="forms" /> });

/** /ds/forms: form controls, time controls, compositions and flows. */
export function DsForms() {
  return (
    <>
      <PageHeader title="Forms" description="Form controls, calendars and time, form layouts, validation and flows." />
      <FormsSections />
    </>
  );
}
