"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { formatDateTimeLong, formatRelative } from "../lib/format";

export function RelativeTime({ at }: { at: number | null }) {
  if (at == null) return <span className="text-fg-3">–</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild><time dateTime={new Date(at).toISOString()} className="cursor-default">{formatRelative(at)}</time></TooltipTrigger>
      <TooltipContent>{formatDateTimeLong(at)}</TooltipContent>
    </Tooltip>
  );
}
