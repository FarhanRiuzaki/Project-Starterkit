import { RouteSkeleton, type Section } from "../route-skeleton";

/** Loading shape of /ds with the loaded page's section heights at the 1440 px reference width (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 68 },
  { kind: "bar", h: 40 },
  { kind: "panels", panels: [[12, 794]] },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
