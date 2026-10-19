import { RouteSkeleton, type Section } from "../route-skeleton";

/** Loading shape of /users with the loaded page's section heights at 1440 (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "bar", h: 32 },
  { kind: "table", h: 972, rows: 15 },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
