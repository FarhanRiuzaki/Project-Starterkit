import { RouteSkeleton, type Section } from "../route-skeleton";

/** Loading shape of /users with the loaded page's section heights at the 1440 px reference width (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "bar", h: 32 },
  { kind: "table", chrome: 192, rows: "page" },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
