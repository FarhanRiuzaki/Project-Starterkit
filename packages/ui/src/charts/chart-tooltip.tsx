type Row = { name: string; value: string; color: string; striped?: boolean };

/**
 * Chart tooltip (spec §6.7): inverse surface (`--tip`, ring in dark via --shadow-overlay), radius 10, padding 10 12,
 * min-width 168; eyebrow = period; one row per series (8 px dot, name in tip-2, value right 500 tabular). Fades 120 ms.
 */
export function ChartTooltipBox({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="chart-tip grid min-w-42 max-w-80 gap-1 bg-tip px-3 py-2.5 text-body-sm text-tip-fg shadow-overlay">
      <span className="eyebrow mb-0.5 truncate text-tip-2" title={title}>{title}</span>
      {rows.map((r) => (
        <span key={r.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <span aria-hidden="true" className={r.striped ? "chart-stripes size-2 rounded-xs" : "size-2 rounded-xs"} style={{ backgroundColor: r.color }} />
          <span className="truncate text-tip-2" title={r.name}>{r.name}</span>
          <span className="pl-3 font-medium tabular">{r.value}</span>
        </span>
      ))}
    </div>
  );
}
