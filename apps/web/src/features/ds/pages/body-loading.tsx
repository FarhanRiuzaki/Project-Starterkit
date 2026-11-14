"use client";

import { useDelayedFlag } from "@starterkit/ui/motion";
import { LoadingShape } from "@/components/route-skeleton";
import type { DsPageId } from "../pages";
import { DS_BODY_SHAPE } from "../shapes";

/**
 * Holds a page body's space while its chunk loads and shows the body's loading shape (the sections its route's
 * loading.tsx lists under the header); hidden for the first 150 ms, like every loading state. The E2E waits for
 * `body-loading` to go.
 */
export function BodyLoading({ page }: { page: DsPageId }) {
  const shown = useDelayedFlag(true);
  return <div data-slot="body-loading" className="min-h-screen"><LoadingShape sections={DS_BODY_SHAPE[page]} shown={shown} /></div>;
}
