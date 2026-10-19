import { RouteSkeleton, type Section } from "../../route-skeleton";

/** Loading shape of /roles/[id] with the loaded page's section heights at the 1440 px reference width (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[12, 256]] },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
