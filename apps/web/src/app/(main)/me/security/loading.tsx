import { RouteSkeleton, type Section } from "../../route-skeleton";

/** Loading shape of /me/security with the loaded page's section heights at 1440 (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[6, 541], [6, 541]] },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
