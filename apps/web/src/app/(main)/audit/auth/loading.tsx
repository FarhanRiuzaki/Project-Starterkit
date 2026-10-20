import { RouteSkeleton, type Section } from "@/components/route-skeleton";

/** Loading shape of /audit/auth with the loaded page's section heights at the 1440 px reference width (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 68 },
  { kind: "table", chrome: 236, rows: "page" },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
