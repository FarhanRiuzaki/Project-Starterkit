import { useId } from "react";

/** A url()-safe id prefix per chart instance (useId may contain characters a url(#…) reference rejects). */
export function useChartId(): string {
  return `c${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Shared SVG paint servers in a zero-size inline <svg>: the 45° stripe pattern (2 px line / 4 px gap, `--stripe`)
 * and one vertical area gradient per colour (series colour at `--chart-area-alpha` → 0). Referenced from any SVG in
 * the document as url(#<id>-stripes) / url(#<id>-grad-<i>).
 */
export function ChartDefs({ id, gradients = [] }: { id: string; gradients?: string[] }) {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        <pattern id={`${id}-stripes`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="6" style={{ fill: "var(--stripe)" }} />
        </pattern>
        {gradients.map((c, i) => (
          <linearGradient key={i} id={`${id}-grad-${i}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: c, stopOpacity: "var(--chart-area-alpha)" }} />
            <stop offset="1" style={{ stopColor: c, stopOpacity: 0 }} />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}
