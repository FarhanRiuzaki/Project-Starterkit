"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { BodyLoading } from "./body-loading";

/** The body loads after hydration in its own chunk: the route's first load is the header alone (ui-standard §5). */
const AffectGroup = dynamic(() => import("../affect/gallery").then((m) => m.AffectGroup), { ssr: false, loading: () => <BodyLoading page="visuals" /> });

/** /ds/visuals: affectUI's illustrations, motion and blocks (the group is the whole body). */
export function DsVisuals() {
  return (
    <>
      <PageHeader title="Illustrations" description="Illustrations, motion scenes and blocks from affectUI, in upstream's own look." />
      <AffectGroup id="visuals" />
    </>
  );
}
