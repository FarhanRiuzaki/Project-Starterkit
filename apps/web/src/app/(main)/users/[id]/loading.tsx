import { RouteSkeleton, type Section } from "../../route-skeleton";

/**
 * Loading shape of /users/[id] with the loaded page's section heights at 1440 (see route-skeleton): the detail cards
 * (two rows, 16 px apart on the page; the second row is 8 px shorter here for the 24 px section gap), sessions, activity.
 */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[6, 203], [6, 203]] },
  { kind: "panels", panels: [[12, 195]] },
  { kind: "table", h: 286, rows: 3, rowHeight: 44 },
  { kind: "table", h: 184, rows: 2, rowHeight: 44 },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
