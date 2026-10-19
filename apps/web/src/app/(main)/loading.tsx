import { RouteSkeleton, type Section } from "./route-skeleton";

/** Loading shape of / with the loaded page's section heights at 1440 (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "kpi", h: 130, count: 4 },
  { kind: "panels", panels: [[12, 374]] },
  { kind: "table", h: 356, rows: 5 },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
