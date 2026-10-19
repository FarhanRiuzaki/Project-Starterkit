import { RouteSkeleton, type Section } from "../route-skeleton";

/** Loading shape of /me with the loaded page's section heights at the 1440 px reference width (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[12, 352]] },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
