"use client";

import { ChunkBoundary, LazyMount, Panel } from "@starterkit/ui/ds";
import { useDelayedFlag } from "@starterkit/ui/motion";
import dynamic from "next/dynamic";
import type { AffectDemo } from "./types";

/** Space a group holds before its chunk has loaded, px: about two rows of cards. */
const GROUP_MIN_HEIGHT = 480;

function GroupLoading() {
  const shown = useDelayedFlag(true);
  return <div aria-busy={shown || undefined} className="min-h-48" />;
}

function DemoGrid({ demos }: { demos: readonly AffectDemo[] }) {
  return (
    <ul className="grid grid-cols-12 gap-3">
      {demos.map(({ slug, name, Demo, wide }) => (
        <li key={slug} data-affect={slug} className={wide ? "col-span-12 grid min-w-0 content-start gap-3 rounded-lg border border-line bg-inset p-3" : "col-span-12 grid min-w-0 content-start gap-3 rounded-lg border border-line bg-inset p-3 md:col-span-6 xl:col-span-4"}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <h3 className="text-title-3 text-fg">{name}</h3>
            <span className="font-mono text-label text-fg-3">{slug}</span>
          </div>
          <div className="min-w-0 rounded-md border border-line bg-card p-4"><Demo /></div>
        </li>
      ))}
    </ul>
  );
}

/** Each group is its own chunk, loaded when it scrolls near: the route's first load carries none of the items. */
const group = (load: () => Promise<{ DEMOS: readonly AffectDemo[] }>) => dynamic(async () => {
  const { DEMOS } = await load();
  return function Group() { return <DemoGrid demos={DEMOS} />; };
}, { ssr: false, loading: GroupLoading });

const GROUPS = [
  { id: "actions", title: "Buttons and navigation", Group: group(() => import("./demos-actions")) },
  { id: "inputs", title: "Inputs", Group: group(() => import("./demos-inputs")) },
  { id: "feedback", title: "Feedback, text and agents", Group: group(() => import("./demos-feedback")) },
  { id: "content", title: "Data display, cards and chat", Group: group(() => import("./demos-content")) },
  { id: "visuals", title: "Illustrations, motion and blocks", Group: group(() => import("./demos-visuals")) },
] as const;

/** The groups of /ds/affect; loaded after hydration by `AffectGallery` (affect-page.tsx). */
export function AffectGroups() {
  return (
      <div className="grid gap-4">
        {GROUPS.map(({ id, title, Group }) => (
          <Panel key={id} title={title}>
            <section aria-label={title} data-affect-group={id}>
              <LazyMount minHeight={GROUP_MIN_HEIGHT}><ChunkBoundary><Group /></ChunkBoundary></LazyMount>
            </section>
          </Panel>
        ))}
      </div>
  );
}
