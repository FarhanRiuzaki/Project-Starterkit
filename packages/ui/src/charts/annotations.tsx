"use client";

import { usePlotArea, useXAxisScale } from "recharts";
import { type Annotation, annotationLayout } from "../lib/chart-layout";

const CHIP_H = 16;
const chipWidth = (text: string) => Math.ceil([...text].length * 6.6) + 12;

/**
 * Event annotations (spec §6.8) inside a Recharts plot: 1 px dashed vertical line + 16 px flag chip with a `label` at
 * the top of the plot. At most 3 visible (the latest); earlier ones collapse into a "+N" chip at the plot's left edge.
 */
export function Annotations({ events, domain }: { events: Annotation[]; domain: [number, number] }) {
  const scale = useXAxisScale();
  const plot = usePlotArea();
  if (!scale || !plot || events.length === 0) return null;
  const { visible, hidden } = annotationLayout(events, domain);
  const right = plot.x + plot.width;
  return (
    <g className="chart-fade" aria-hidden="true">
      {visible.map((e) => {
        const x = Number(scale(e.t));
        if (!Number.isFinite(x)) return null;
        const w = chipWidth(e.label);
        // Flip the chip to the left of its line near the right edge.
        const cx = x + w > right ? x - w : x;
        return (
          <g key={`${e.t}-${e.label}`}>
            <line x1={x} x2={x} y1={plot.y} y2={plot.y + plot.height} stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="4 4" />
            <rect x={cx} y={plot.y} width={w} height={CHIP_H} rx={4} fill="var(--tray)" stroke="var(--line)" />
            <text x={cx + 6} y={plot.y + 12} className="fill-fg-2 text-label">{e.label}<title>{e.label}</title></text>
          </g>
        );
      })}
      {hidden.length > 0 && (
        <g>
          <rect x={plot.x} y={plot.y} width={chipWidth(`+${hidden.length}`)} height={CHIP_H} rx={4} fill="var(--tray)" stroke="var(--line)" />
          <text x={plot.x + 6} y={plot.y + 12} className="fill-fg-2 text-label">+{hidden.length}<title>{hidden.map((h) => h.label).join(", ")}</title></text>
        </g>
      )}
    </g>
  );
}
