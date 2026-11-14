"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { BodyLoading } from "./body-loading";

/** The body loads after hydration in its own chunk: the route's first load is the header alone (ui-standard §5). */
const ComponentsSections = dynamic(() => import("./components-body").then((m) => m.ComponentsSections), { ssr: false, loading: () => <BodyLoading page="components" /> });

/** /ds/components: primitives and navigation. */
export function DsComponents() {
  return (
    <>
      <PageHeader title="Components" description="Buttons, inputs, chips, tabs, menus, dialogs and navigation, with sample data." />
      <ComponentsSections />
    </>
  );
}
