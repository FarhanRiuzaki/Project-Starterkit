"use client";

import { APP_TIME_ZONE_LABEL } from "../lib/format";
import { Segmented } from "./segmented";

export type RangeKey = "1h" | "24h" | "7d" | "30d";

const OPTIONS = [
  { value: "1h", label: "1 hour" }, { value: "24h", label: "24 hours" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" },
] as const satisfies readonly { value: RangeKey; label: string }[];

/** One range picker per page; the supported ranges are the `RangeKey` union. Times are shown in WIB. */
export function TimeRangePicker({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Segmented label="Time range" value={value} onChange={onChange} options={OPTIONS} />
      <span className="font-mono text-caption text-fg-3">{APP_TIME_ZONE_LABEL}</span>
    </div>
  );
}
