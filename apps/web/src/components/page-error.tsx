"use client";

import { ErrorState, ReloadButton } from "@starterkit/ui/ds";
import { isChunkError } from "@starterkit/ui/lib/chunk-error";

/**
 * Body of a route error boundary (app/error.tsx, app/(main)/error.tsx): what + why + next step. A render error offers
 * "Try again": Next's `retry` re-fetches the segment from the server and re-renders it (Next 16.3 error.js; `reset`
 * would only re-render the client part, so a server render error would stay). A chunk that failed to load offers
 * "Reload page". No error message is shown (it may carry internals), only the server's digest as a reference.
 */
export function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const detail = error.digest ? `Reference ${error.digest}` : null;
  if (isChunkError(error)) {
    return (
      <ErrorState title="This page needs a reload"
        cause="A newer version of the app was released while this page was open, so part of the page couldn't load. Reload the page to get the new version."
        detail={detail} action={<ReloadButton />} />
    );
  }
  return (
    <ErrorState title="Couldn't show this page"
      cause="The app hit an unexpected error while showing this page. Try again; if it continues, contact your administrator."
      detail={detail} onRetry={retry} />
  );
}
