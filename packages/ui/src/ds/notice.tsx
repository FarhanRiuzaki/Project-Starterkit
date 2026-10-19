import type { ReactNode } from "react";
import { Icon } from "../ui/icon";
import { InfoIcon, WarningIcon } from "../ui/icons";
import { cn } from "../lib/cn";

/**
 * Inline notice (spec §5.13): 40 px min, radius 12; `warn` = Degraded soft with ink text + icon (error with data,
 * stale), `info` = tray. The page keeps showing the data it has. Icon + text, not color alone.
 * `live` → role=status (announced) for notices that appear in response to data; static notices stay plain markup.
 * `lines` → one paragraph per line (the single aggregated page notice, UI standard §1.2); an empty list renders
 * nothing, so pages can pass the lines unconditionally.
 */
export function Notice({ tone = "info", live, children, lines }: {
  tone?: "info" | "warn"; live?: boolean; children?: ReactNode; lines?: { key: string; text: ReactNode }[];
}) {
  if (lines && lines.length === 0 && children == null) return null;
  const icon = tone === "warn" ? WarningIcon : InfoIcon;
  return (
    <div role={live ? "status" : undefined} className={cn("flex min-h-10 items-start gap-2.5 rounded-lg px-3 py-2.5 text-body-sm",
      tone === "warn" ? "bg-degraded-soft text-degraded-ink" : "border border-line bg-tray text-fg-2")}>
      <Icon icon={icon} className="mt-px size-4 shrink-0" />
      {lines ? (
        <div className="grid min-w-0 gap-1 break-words">
          {children != null && <p>{children}</p>}
          {lines.map((l) => <p key={l.key}>{l.text}</p>)}
        </div>
      ) : <p className="min-w-0 break-words">{children}</p>}
    </div>
  );
}
