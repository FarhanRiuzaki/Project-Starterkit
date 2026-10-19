"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { formatDateTimeLong, formatRelative } from "../lib/format";

/**
 * "5 min ago" with the full time in a tooltip. Server-rendered (prefetched pages), so across a minute boundary the
 * browser would compute other text while hydrating: the server's text stays until the next render, without a
 * hydration error (suppressHydrationWarning).
 */
export function RelativeTime({ at }: { at: number | null }) {
  if (at == null) return <span className="text-fg-3">–</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild><time dateTime={new Date(at).toISOString()} className="cursor-default" suppressHydrationWarning>{formatRelative(at)}</time></TooltipTrigger>
      <TooltipContent>{formatDateTimeLong(at)}</TooltipContent>
    </Tooltip>
  );
}
