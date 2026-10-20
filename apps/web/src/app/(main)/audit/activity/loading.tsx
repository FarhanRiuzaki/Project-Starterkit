import { RouteSkeleton, type Section } from "@/components/route-skeleton";

/** Loading shape of /audit/activity with the loaded page's section heights at the 1440 px reference width (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "table", chrome: 196, rows: "page" },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
