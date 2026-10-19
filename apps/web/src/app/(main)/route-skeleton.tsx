"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Panel, StatTiles, StatTileSkeletons } from "@starterkit/ui/ds";
import { LOADING, useDelayedFlag, useHoldShape } from "@starterkit/ui/motion";
import { Skeleton } from "@starterkit/ui/ui/skeleton";

/**
 * Route loading shapes (UI standard §3, spec §5.13; the reference app's pattern): each route's `loading.tsx` lists its
 * sections with the height the loaded page has at 1440 with the seed data (lists: one first page), so the page swaps
 * in without moving anything below. Pages are server-prefetched, so this shows only while a slow server renders the
 * next page; like every loading state it stays hidden for its first 150 ms (useDelayedFlag), so a fast route never
 * flashes it, and once shown it stays at least 300 ms: Next drops it the moment the page is ready, so it hands itself
 * to the page template (useHoldShape), which keeps it over the page until then.
 * - `header`: title + description; `bar`: a toolbar.
 * - `kpi`: the KPI tray with `count` tiles.
 * - `panels`: one row of panels on the 12-column grid, `[span, height]` each.
 * - `table`: a flush panel with a 40 px header row and `rows` rows of `rowHeight` px.
 */
export type Section =
  | { kind: "header"; h: number }
  | { kind: "bar"; h: number }
  | { kind: "kpi"; h: number; count?: number }
  | { kind: "panels"; panels: readonly (readonly [6 | 12, number])[] }
  | { kind: "table"; h: number; rows: number; rowHeight?: number };

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

function TableBlock({ h, rows, rowHeight = 52 }: { h: number; rows: number; rowHeight?: number }) {
  return (
    <div className="grid overflow-hidden" style={{ height: h }}>
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

export function RouteSkeleton({ sections }: { sections: readonly Section[] }) {
  const shown = useDelayedFlag(true);
  const hold = useHoldShape();
  const shownAt = useRef(0);
  useEffect(() => { if (shown) shownAt.current = performance.now(); }, [shown]);
  // As the page replaces it (layout cleanup: before the browser paints the page), stay up for the rest of the minimum.
  useLayoutEffect(() => () => {
    if (shownAt.current) hold(<Shape sections={sections} shown />, shownAt.current + LOADING.minVisible * 1000);
  }, [hold, sections]);
  return <Shape sections={sections} shown={shown} />;
}

function Shape({ sections, shown }: { sections: readonly Section[]; shown: boolean }) {
  return (
    <div className={shown ? "grid gap-section" : "invisible grid gap-section"} aria-busy={shown || undefined} aria-label="Loading page">
      {sections.map((s, i) => {
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
            return <TableBlock key={i} h={s.h} rows={s.rows} rowHeight={s.rowHeight} />;
        }
      })}
    </div>
  );
}
