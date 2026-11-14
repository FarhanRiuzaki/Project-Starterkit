"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";

/**
 * The page imports only what every page already loads (the header, next/dynamic); the groups arrive in their own
 * chunk after hydration. A static import of the gallery made the bundler re-split a chunk the whole app shares, which
 * cost every other route about 465 bytes of first-load JS, with three of them under 300 bytes from the budget.
 */
const AffectGroups = dynamic(() => import("./gallery").then((m) => m.AffectGroups), { ssr: false, loading: () => <div className="min-h-screen" /> });

/** Every vendored affectUI item (packages/ui/src/affect) with fictional sample data, in upstream's own look and motion. */
export function AffectGallery() {
  return (
    <>
      <PageHeader title="affectUI components" trail={[{ label: "Design system", href: "/ds" }]}
        description="The free affectUI items vendored in packages/ui/src/affect, with fictional sample data. Colours and motion are upstream's own, unchanged." />
      <AffectGroups />
    </>
  );
}
