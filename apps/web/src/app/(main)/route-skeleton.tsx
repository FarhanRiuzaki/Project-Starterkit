"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Panel, StatTiles, StatTileSkeletons } from "@starterkit/ui/ds";
import { LOADING, useDelayedFlag, useHoldShape } from "@starterkit/ui/motion";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { useAuth } from "@/lib/client/auth-context";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/shared/paging";
import type { PermissionName } from "@/lib/shared/permissions";

/**
 * Route loading shapes (UI standard §3, spec §5.13; the reference app's pattern). Each route's `loading.tsx` lists its
 * sections with the heights the loaded page has at the 1440 px reference width with the seed data (lists: one first
 * page), so the page swaps in without moving anything below. Heights are that reference, not measured at run time.
 * Pages are server-prefetched, so this shows only while a slow server renders the next page:
 * - for the first 150 ms nothing changes on screen: on a client navigation a frozen copy of the page you were on
 *   stays in place (no blank, no skeleton flash); on a document load the shape holds its place hidden;
 * - then the shape shows (useDelayedFlag) and stays at least 300 ms: Next drops it the moment the page is ready, so
 *   it hands itself to the page template (useHoldShape), which keeps it over the page until then.
 *
 * Sections: `header` (title + description), `bar` (a toolbar), `kpi` (KPI tray, `count` tiles), `panels` (one row of
 * panels on the 12-column grid, `[span, height]` each), `table` (a flush panel: `chrome` px of header, column row and
 * footer, plus `rows` rows of `rowHeight` px; `rows: "page"` = the URL's page size). `perm` keeps a section only for a
 * user with that permission, `without` only for one without it (the page shows those parts the same way).
 */
type Gate = { perm?: PermissionName; without?: PermissionName };
export type Section = Gate & (
  | { kind: "header"; h: number }
  | { kind: "bar"; h: number }
  | { kind: "kpi"; h: number; count: number }
  | { kind: "panels"; panels: readonly (readonly [6 | 12, number])[] }
  | { kind: "table"; chrome: number; rows: number | "page"; rowHeight?: number }
);

const SPAN = { 6: "col-span-12 lg:col-span-6", 12: "col-span-12" } as const;

function PanelBlock({ className, h }: { className?: string; h: number }) {
  return (
    <div className={className ? `grid ${className}` : "grid"} style={{ height: h }}>
      <Panel title={<Skeleton className="h-3 w-32" />} bodyClassName="flex">
        <Skeleton className="flex-1 rounded-md" />
      </Panel>
    </div>
  );
}

function TableBlock({ chrome, rows, rowHeight }: { chrome: number; rows: number; rowHeight: number }) {
  return (
    <div className="grid overflow-hidden" style={{ height: chrome + rows * rowHeight }}>
      <Panel flush title={<Skeleton className="h-3 w-32" />}>
        <div className="h-10 border-b border-line bg-tray" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-3" style={{ height: rowHeight }}>
            <Skeleton className="size-7 rounded-full" /><Skeleton className="h-2.5 w-1/4" /><Skeleton className="ml-auto h-2.5 w-1/6" />
          </div>
        ))}
      </Panel>
    </div>
  );
}

/**
 * The page on screen when this shape mounts (a client navigation), as an inert static copy; null on a document load
 * (there the shape itself is what the server sent). Read while rendering, before React replaces that page.
 */
function usePreviousPage(): HTMLElement | null {
  const [copy] = useState(() => {
    if (typeof document === "undefined") return null;
    const page = document.querySelector<HTMLElement>("[data-page]");
    if (!page || page.querySelector("[data-route-skeleton]")) return null;
    const c = page.cloneNode(true) as HTMLElement;
    c.removeAttribute("data-page");
    c.setAttribute("data-frozen", "");
    c.setAttribute("aria-hidden", "true");
    c.inert = true;
    return c;
  });
  return copy;
}

export function RouteSkeleton({ sections }: { sections: readonly Section[] }) {
  const shown = useDelayedFlag(true);
  const hold = useHoldShape();
  const previous = usePreviousPage();
  const frozen = useRef<HTMLDivElement>(null);
  const shownAt = useRef(0);
  useEffect(() => { if (shown) shownAt.current = performance.now(); }, [shown]);
  // Before the browser paints: the copy of the previous page goes in place, so the navigation never shows a blank.
  useLayoutEffect(() => { if (previous) frozen.current?.replaceChildren(previous); }, [previous]);
  // As the page replaces it (layout cleanup: before the browser paints the page), stay up for the rest of the minimum.
  useLayoutEffect(() => () => {
    if (shownAt.current) hold(<Shape sections={sections} shown />, shownAt.current + (LOADING.minVisible + LOADING.margin) * 1000);
  }, [hold, sections]);
  if (!previous || shown) return <Shape sections={sections} shown={shown} />;
  return (
    <div className="grid *:col-start-1 *:row-start-1">
      <div ref={frozen} className="min-w-0" />
      <Shape sections={sections} shown={false} />
    </div>
  );
}

function Shape({ sections, shown }: { sections: readonly Section[]; shown: boolean }) {
  const { can } = useAuth();
  const size = Number(useSearchParams().get("pageSize"));
  const pageRows = (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
  const ref = useRef<HTMLDivElement>(null);
  // Every shape's shimmer runs on the document clock, so the held copy that replaces this one continues the sweep.
  useLayoutEffect(() => {
    for (const a of ref.current?.getAnimations({ subtree: true }) ?? []) a.startTime = 0;
  }, [shown]);
  return (
    <div ref={ref} data-route-skeleton="" role="status" aria-label="Loading page" aria-busy={shown || undefined}
      className={shown ? "grid gap-section" : "invisible grid gap-section"}>
      {sections.filter((s) => (!s.perm || can(s.perm)) && (!s.without || !can(s.without))).map((s, i) => {
        switch (s.kind) {
          case "header":
            return (
              <div key={i} className="grid content-start gap-2" style={{ height: s.h }}>
                <Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-full max-w-md" />
              </div>
            );
          case "bar":
            return <div key={i} className="flex items-center gap-2" style={{ height: s.h }}><Skeleton className="h-8 w-full max-w-xl rounded-md" /></div>;
          case "kpi":
            return <div key={i} className="grid" style={{ height: s.h }}><StatTiles><StatTileSkeletons count={s.count} /></StatTiles></div>;
          case "panels":
            return (
              <div key={i} className="grid grid-cols-12 gap-gutter">
                {s.panels.map(([span, h], j) => <PanelBlock key={j} className={SPAN[span]} h={h} />)}
              </div>
            );
          case "table":
            return <TableBlock key={i} chrome={s.chrome} rows={s.rows === "page" ? pageRows : s.rows} rowHeight={s.rowHeight ?? 52} />;
        }
      })}
    </div>
  );
}
