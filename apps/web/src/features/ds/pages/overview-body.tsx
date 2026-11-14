"use client";

import { InteractiveCard, Panel } from "@starterkit/ui/ds";
import Link from "next/link";
import { ComponentCatalog } from "../component-catalog";
import { DS_PAGES } from "../pages";

const OTHERS = DS_PAGES.filter((p) => p.id !== "overview");

/** /ds below the header: the catalog, then the seven other pages. */
export function OverviewSections() {
  return (
    <>
      <ComponentCatalog />
      <Panel title="Pages" count={OTHERS.length} description="Each page shows its components live, with fictional sample data">
        <ul aria-label="Design system pages" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {OTHERS.map((p) => (
            <li key={p.id} className="grid">
              <InteractiveCard asChild>
                <Link href={p.href}><span className="text-label">{p.label}</span><span className="text-body-sm text-fg-2">{p.summary}</span></Link>
              </InteractiveCard>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
