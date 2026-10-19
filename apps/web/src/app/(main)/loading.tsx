import { RouteSkeleton, type Section } from "./route-skeleton";

/**
 * Loading shape of / with the loaded page's section heights at the 1440 px reference width (see route-skeleton). Like
 * the page, failed sign-ins and recent activity are there only with audit.view.
 */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "kpi", h: 130, count: 4, perm: "audit.view" },
  { kind: "kpi", h: 130, count: 3, without: "audit.view" },
  { kind: "panels", panels: [[12, 374]] },
  { kind: "table", chrome: 96, rows: 5, perm: "audit.view" },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
