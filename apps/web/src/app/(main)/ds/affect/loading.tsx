import { RouteSkeleton, type Section } from "@/components/route-skeleton";

/** Loading shape of /ds/affect: the header and the first group's panel at the 1440 px reference width. */
const SECTIONS: readonly Section[] = [
  { kind: "header", h: 68 },
  { kind: "panels", panels: [[12, 540]] },
];

export default function Loading() {
  return <RouteSkeleton sections={SECTIONS} />;
}
