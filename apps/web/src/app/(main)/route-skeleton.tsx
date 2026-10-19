"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Panel, StatTiles, StatTileSkeletons } from "@starterkit/ui/ds";
import { DUR, LOADING, useDelayedFlag, useHoldShape } from "@starterkit/ui/motion";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { useAuth } from "@/lib/client/auth-context";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/shared/paging";
import type { PermissionName } from "@/lib/shared/permissions";

/**
 * Route loading shapes (UI standard §3, spec §5.13; the reference app's pattern). Each route's `loading.tsx` lists its
 * sections with the heights the loaded page has at the 1440 px reference width with the seed data (lists: one first
 * page), so the page swaps in without moving anything below. Heights are that reference, not measured at run time.
 * Pages are server-prefetched, so this shows only while a slow server renders the next page:
 * - for the first 150 ms nothing changes on screen: on a client navigation a frozen copy of what was on screen stays
 *   exactly where it was (no blank, no skeleton flash), then crossfades to the page or the shape; on a document load
 *   the shape holds its place hidden;
 * - then the shape shows (useDelayedFlag) and stays at least 300 ms: Next drops it the moment the page is ready, so
 *   it hands itself to the page template (useHoldShape), which keeps it over the page until then.
 *
 * Sections: `header` (title + description), `bar` (a toolbar), `kpi` (KPI tray, `count` tiles), `panels` (one row of
 * panels on the 12-column grid, `[span, height]` each), `table` (a flush panel: `chrome` px of header, column row and
 * footer, plus `rows` rows of `rowHeight` px; `rows: "page"` = the URL's page size, at most `max` when the reference
 * data has fewer rows than a page). `perm` keeps a section only for a
 * user with that permission, `without` only for one without it (the page shows those parts the same way).
 */
type Gate = { perm?: PermissionName; without?: PermissionName };
export type Section = Gate & (
  | { kind: "header"; h: number }
  | { kind: "bar"; h: number }
  | { kind: "kpi"; h: number; count: number }
  | { kind: "panels"; panels: readonly (readonly [6 | 12, number])[] }
  | { kind: "table"; chrome: number; rows: number | "page"; max?: number; rowHeight?: number }
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

type Previous = { copy: HTMLElement; rect: DOMRect; scrolled: [HTMLElement, number, number][] };

/**
 * What the page region showed when this shape mounted on a client navigation (the page, or a held shape over it),
 * copied while rendering, before React replaces it. Null on a document load: the shape itself is what the server sent
 * (a fallback already in the page box). With the deferred Framer layer, the copy is taken from the page that isn't
 * leaving. Scroll positions of scrolled boxes inside are noted, to restore them on the copy.
 */
function usePreviousPage(): Previous | null {
  const [previous] = useState<Previous | null>(() => {
    if (typeof document === "undefined") return null;
    const page = [...document.querySelectorAll<HTMLElement>("[data-page]")]
      .find((p) => !p.closest("[inert]")); // not a page the Framer layer is fading out (motion/framer.tsx Frozen)
    const root = page?.parentElement;
    if (!page || !root || page.querySelector("[data-route-skeleton]")) return null;
    const copy = root.cloneNode(true) as HTMLElement;
    // Same order in both trees: the copy's twin of each scrolled box, to restore its position once the copy is shown.
    const from = [root, ...root.querySelectorAll<HTMLElement>("*")];
    const to = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
    const scrolled = from.flatMap((el, i): [HTMLElement, number, number][] => (el.scrollTop || el.scrollLeft ? [[to[i]!, el.scrollTop, el.scrollLeft]] : []));
    for (const el of copy.querySelectorAll("[data-page]")) el.removeAttribute("data-page");
    // A held shape already fading out over the page would stand at full opacity in the copy (no animations there).
    for (const el of copy.querySelectorAll("[data-held].animate-reveal-out")) el.remove();
    copy.setAttribute("data-frozen", "");
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    return { copy, rect: root.getBoundingClientRect(), scrolled };
  });
  return previous;
}

/**
 * Shows the copy at the exact viewport box the page had, above the page region and outside its enter animation (one
 * source of the old page: a page the Framer layer is still fading out is hidden meanwhile, by globals.css). Leaves with a short fade,
 * over the page or the shape that takes its place.
 */
function showCopy({ copy, rect, scrolled }: Previous): () => void {
  const holder = document.createElement("div");
  holder.setAttribute("data-frozen-holder", "");
  Object.assign(holder.style, { position: "fixed", top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, pointerEvents: "none" });
  holder.append(copy);
  document.body.append(holder);
  for (const [el, top, left] of scrolled) { el.scrollTop = top; el.scrollLeft = left; }
  return () => {
    const fade = holder.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.fast * 1000, fill: "forwards" });
    fade.finished.then(() => holder.remove(), () => holder.remove());
  };
}

export function RouteSkeleton({ sections }: { sections: readonly Section[] }) {
  const shown = useDelayedFlag(true);
  const hold = useHoldShape();
  const previous = usePreviousPage();
  const shownAt = useRef(0);
  useEffect(() => { if (shown) shownAt.current = performance.now(); }, [shown]);
  // Before the browser paints: the copy of the previous screen goes up, until the shape is due or the page is here.
  useLayoutEffect(() => (previous && !shown ? showCopy(previous) : undefined), [previous, shown]);
  // As the page replaces it (layout cleanup: before the browser paints the page), stay up for the rest of the minimum.
  useLayoutEffect(() => () => {
    if (shownAt.current) hold(<Shape sections={sections} shown />, shownAt.current + (LOADING.minVisible + LOADING.margin) * 1000);
  }, [hold, sections]);
  return <Shape sections={sections} shown={shown} />;
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
            return <TableBlock key={i} chrome={s.chrome} rows={s.rows === "page" ? Math.min(pageRows, s.max ?? pageRows) : s.rows} rowHeight={s.rowHeight ?? 52} />;
        }
      })}
    </div>
  );
}
