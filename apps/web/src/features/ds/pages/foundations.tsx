"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { BodyLoading } from "./body-loading";

/** The body loads after hydration in its own chunk: the route's first load is the header alone (ui-standard §5). */
const FoundationsSections = dynamic(() => import("./foundations-body").then((m) => m.FoundationsSections), { ssr: false, loading: () => <BodyLoading page="foundations" /> });

/** /ds/foundations: tokens and icons. */
export function DsFoundations() {
  return (
    <>
      <PageHeader title="Foundations" description="Brand, surfaces, color, the type scale and the icon library." />
      <FoundationsSections />
    </>
  );
}
