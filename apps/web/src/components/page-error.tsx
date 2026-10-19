"use client";

import { ErrorState } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { RefreshIcon } from "@starterkit/ui/ui/icons";

/**
 * A code chunk that failed to load: typically its file is gone because a newer version was deployed while the page
 * was open. Trying again asks for the same missing file, so only a full reload helps.
 */
export function isChunkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === "ChunkLoadError" || /loading (css )?chunk|failed to load chunk|dynamically imported module|importing a module script failed/i.test(e.message);
}

/**
 * Body of a route error boundary (app/error.tsx, app/(main)/error.tsx): what + why + next step. A render error offers
 * "Try again" (`reset` re-renders the segment); a chunk that failed to load offers "Reload page". No error message is
 * shown (it may carry internals), only the server's digest as a reference.
 */
export function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const detail = error.digest ? `Reference ${error.digest}` : null;
  if (isChunkError(error)) {
    return (
      <ErrorState title="This page needs a reload"
        cause="A newer version of the app was released while this page was open, so part of the page couldn't load. Reload the page to get the new version."
        detail={detail} action={<Button size="sm" variant="secondary" onClick={() => window.location.reload()}><Icon icon={RefreshIcon} />Reload page</Button>} />
    );
  }
  return (
    <ErrorState title="Couldn't show this page"
      cause="The app hit an unexpected error while showing this page. Try again; if it continues, contact your administrator."
      detail={detail} onRetry={reset} />
  );
}
