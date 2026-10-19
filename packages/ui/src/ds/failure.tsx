import { describeFailure, staleText } from "../lib/failure";
import { Notice } from "./notice";
import { ErrorState } from "./states";

/**
 * Error with no data: ErrorState with a guide-style cause; the raw message sits in a muted detail line.
 * `error` is any thrown value; a `{ status, code, message }` API error reads as such.
 */
export function Failure({ title, error, source, next, onRetry }: {
  title: string; error: unknown; source: string; next?: string; onRetry?: () => void;
}) {
  const f = describeFailure(error, source, next);
  return <ErrorState title={title} cause={f.cause} detail={f.detail} onRetry={onRetry} />;
}

/** Refetch failed but earlier data is still shown (error with data / stale): keep the data, say its age and source. */
export function StaleNotice({ at, source }: { at: number; source: string }) {
  return <Notice tone="warn" live>{staleText(at, source)}</Notice>;
}
