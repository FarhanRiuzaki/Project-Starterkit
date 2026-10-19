"use client";

import { type DehydratedState, HydrationBoundary, hydrate, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect } from "react";

/**
 * React Query's HydrationBoundary for server-prefetched data (lib/server/prefetch.tsx). New queries fill the cache
 * during render, so the server HTML and the first client render are already filled. For a query already cached (a
 * revisited page), HydrationBoundary applies the newer server data in a passive effect, after the page's queries have
 * subscribed and refetched their stale cache; applying it here in a layout effect first (hydrate keeps the newer of
 * the two) means they find it fresh and the browser doesn't fetch again what the server just sent.
 */
export function Hydrate({ state, children }: { state: DehydratedState | undefined; children: React.ReactNode }) {
  const client = useQueryClient();
  useLayoutEffect(() => {
    if (state) hydrate(client, state);
  }, [client, state]);
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
