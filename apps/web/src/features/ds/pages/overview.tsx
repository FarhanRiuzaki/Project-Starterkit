"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { BodyLoading } from "./body-loading";

/** The body loads after hydration in its own chunk: the route's first load is the header alone (ui-standard §5). */
const OverviewSections = dynamic(() => import("./overview-body").then((m) => m.OverviewSections), { ssr: false, loading: () => <BodyLoading page="overview" /> });

/** /ds: the component catalog and the way to the seven other pages. */
export function DsOverview() {
  return (
    <>
      <PageHeader title="Design system" description="Tokens, components, charts and states, with fictional sample data." />
      <OverviewSections />
    </>
  );
}
