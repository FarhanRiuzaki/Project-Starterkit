import { RouteSkeleton, type Section } from "../route-skeleton";

/** Loading shape of /permissions with the loaded page's section heights at 1440 (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "bar", h: 32 },
  { kind: "table", h: 628, rows: 11, rowHeight: 44 },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
