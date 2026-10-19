// Error / stale copy shared by every page (copy guide §4: what + why + next; raw text apart).
import { formatDateTimeLong } from "./format";

/** Any thrown value or `{ status, message }` → the parts describeFailure reads. */
function failureParts(err: unknown): { status?: number; message?: string } {
  if (typeof err === "string") return { message: err };
  if (err == null || typeof err !== "object") return {};
  const o = err as { status?: unknown; message?: unknown };
  return { status: typeof o.status === "number" ? o.status : undefined, message: typeof o.message === "string" ? o.message : undefined };
}

export const DEFAULT_NEXT_STEP = "Try again in a minute. If it continues, contact an administrator.";

/**
 * Failure → "why" sentence + raw detail (shown muted, never as the headline).
 * `source` names the system behind the endpoint. `next` overrides the next-step sentence.
 */
export function describeFailure(err: unknown, source: string, next = DEFAULT_NEXT_STEP): { why: string; cause: string; detail: string } {
  const { status, message } = failureParts(err);
  const raw = (message ?? "").trim().replace(/\.+$/, "");
  let why: string;
  if (status === 504 || /time(d)?[ -]?out|etimedout|aborted/i.test(raw)) why = `${source} didn't respond in time.`;
  else if (status === 404) why = `${source} couldn't find the requested record.`;
  else if (status != null && status >= 500) why = `${source} returned an error.`;
  else if (status == null || status === 0 || /failed to fetch|network|econnrefused|fetch failed/i.test(raw)) why = "The app couldn't reach its server.";
  else why = `${source} couldn't provide the data.`;
  return { why, cause: `${why} ${next}`, detail: raw };
}

/** Stale line (copy guide §4): age + source, plainly. */
export function staleText(at: number | null | undefined, source: string): string {
  return `Showing data from ${formatDateTimeLong(at)}. ${source} isn't responding; values may be out of date.`;
}
