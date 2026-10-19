import { RouteSkeleton, type Section } from "../../route-skeleton";

/**
 * Loading shape of /users/[id] with the loaded page's section heights at the 1440 px reference width (see route-skeleton): the detail cards
 * (two rows, 16 px apart on the page; the second row is 8 px shorter here for the 24 px section gap), sessions, activity.
 */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[6, 203], [6, 203]] },
  { kind: "panels", panels: [[12, 195]] },
  { kind: "table", chrome: 154, rows: 3, rowHeight: 44 },
  { kind: "table", chrome: 96, rows: 2, rowHeight: 44, perm: "audit.view" },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
