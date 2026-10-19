import { RouteSkeleton, type Section } from "@/components/route-skeleton";

/** Loading shape of /audit/auth with the loaded page's section heights at the 1440 px reference width (see route-skeleton). */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 68 },
  { kind: "bar", h: 32 },
  { kind: "table", chrome: 174, rows: "page" },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
