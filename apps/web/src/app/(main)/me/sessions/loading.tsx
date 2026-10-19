import { RouteSkeleton, type Section } from "../../route-skeleton";

/** Loading shape of /me/sessions with the loaded page's section heights at 1440 (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "table", h: 188, rows: 1, rowHeight: 44 },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
