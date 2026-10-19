import "./charts.css";
import { useId } from "react";
import { sparkPath } from "../lib/series";

const W = 200;

/**
 * Trend without axes (spec §6.6): 2 px non-scaling line, area gradient, 6 px dot on the last point. Colour = slot 1;
 * Down mark when `tone="crit"` or the latest value is above `critical`.
 */
export function Sparkline({ values, tone = "primary", critical, height = 32 }: {
  values: (number | null)[]; tone?: "primary" | "crit"; critical?: number; height?: number;
}) {
  const gid = `spark${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const p = sparkPath(values, W, height);
  if (!p.line || !p.last) return null;
  const latest = [...values].reverse().find((v) => v != null && Number.isFinite(v));
  const down = tone === "crit" || (critical != null && latest != null && latest > critical);
  const color = down ? "var(--down-mark)" : "var(--chart-1)";
  return (
    <span className="relative block w-full" style={{ height }} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block size-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: color, stopOpacity: "var(--chart-area-alpha)" }} />
            <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={p.area} fill={`url(#${gid})`} className="chart-fade" />
        <path d={p.line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* HTML dot: the SVG is stretched (preserveAspectRatio none), a circle in it would turn into an ellipse. */}
      <span className="absolute size-1.5 -translate-1/2 rounded-full" style={{ left: `${(p.last[0] / W) * 100}%`, top: `${(p.last[1] / height) * 100}%`, backgroundColor: color }} />
    </span>
  );
}

/** Sparkline in a 56 px inset well: label (caption fg-3) left, value (label fg) right (spec §6.6). */
export function SparkWell({ label, value, values, tone, critical }: {
  label: string; value: string; values: (number | null)[]; tone?: "primary" | "crit"; critical?: number;
}) {
  return (
    <div className="grid h-14 min-w-0 grid-rows-[auto_1fr] gap-0.5 chart-well border border-line bg-inset px-2.5 py-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-caption text-fg-3">{label}</span>
        <span className="shrink-0 text-label tabular text-fg">{value}</span>
      </div>
      <Sparkline values={values} tone={tone} critical={critical} height={20} />
    </div>
  );
}
