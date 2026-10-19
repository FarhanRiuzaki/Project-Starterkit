import { RouteSkeleton, type Section } from "../../../route-skeleton";

/** Loading shape of /users/[id]/edit with the loaded page's section heights at 1440 (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[12, 502]] },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
