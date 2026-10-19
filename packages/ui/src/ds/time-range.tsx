"use client";

import { APP_TIME_ZONE_LABEL } from "../lib/format";
import { Segmented } from "./segmented";

export type RangeKey = "1h" | "24h" | "7d" | "30d" | "90d";

const OPTIONS = [
  { value: "1h", label: "1 hour" }, { value: "24h", label: "24 hours" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
] as const satisfies readonly { value: RangeKey; label: string }[];
const DEFAULT_RANGES: readonly RangeKey[] = ["1h", "24h", "7d", "30d"];

/**
 * One range picker per page; the supported ranges are the `RangeKey` union. Times are shown in WIB.
 * `ranges` = the ranges this page offers, in picker order (default 1 hour … 30 days); day-based lists such as the
 * audit logs offer 7 / 30 / 90 days.
 */
export function TimeRangePicker<K extends RangeKey>({ value, onChange, ranges }: { value: K; onChange: (v: K) => void; ranges?: readonly K[] }) {
  const keys: readonly RangeKey[] = ranges ?? DEFAULT_RANGES;
  const options = OPTIONS.filter((o): o is (typeof OPTIONS)[number] & { value: K } => keys.includes(o.value));
  return (
    <div className="flex items-center gap-2">
      <Segmented label="Time range" value={value} onChange={onChange} options={options} />
      <span className="font-mono text-caption text-fg-3">{APP_TIME_ZONE_LABEL}</span>
    </div>
  );
}
