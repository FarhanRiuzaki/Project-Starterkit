/** [epoch seconds, value] */
export type Point = [number, number];
export type KeyedPoints = { key: string; points: Array<[number, number]> };
export type ChartRow = { t: number } & Record<string, number>;

/** Gabungkan beberapa deret [detik, nilai] menjadi baris per timestamp untuk Recharts. */
export function mergeSeries(series: KeyedPoints[]): ChartRow[] {
  const rows = new Map<number, ChartRow>();
  for (const s of series) {
    for (const [t, v] of s.points) {
      const row = rows.get(t) ?? ({ t } as ChartRow);
      row[s.key] = v;
      rows.set(t, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}
