"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { formatDateTime, formatDateTimeLong, formatRelative } from "../lib/format";

/**
 * "5 min ago" with the full time in a tooltip. Server-rendered (prefetched pages), so across a minute boundary the
 * browser would compute other text while hydrating: the server's text stays until the next render, without a
 * hydration error (suppressHydrationWarning).
 * A touch screen has no hover: under a coarse pointer the short absolute time ("16 Oct, 14:05") is a second line in
 * fg-3, in the server HTML and switched by CSS. `touchDate={false}` when the caller already prints the absolute time.
 */
export function RelativeTime({ at, touchDate = true }: { at: number | null; touchDate?: boolean }) {
  if (at == null) return <span className="text-fg-3">–</span>;
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild><time dateTime={new Date(at).toISOString()} className="cursor-default" suppressHydrationWarning>{formatRelative(at)}</time></TooltipTrigger>
        <TooltipContent>{formatDateTimeLong(at)}</TooltipContent>
      </Tooltip>
      {touchDate && <span className="hidden text-caption text-fg-3 pointer-coarse:block">{formatDateTime(at)}</span>}
    </>
  );
}
