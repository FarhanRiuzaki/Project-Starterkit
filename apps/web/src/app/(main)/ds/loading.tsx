import { RouteSkeleton } from "@/components/route-skeleton";
import { DS_SHAPE } from "@/features/ds/shapes";

/** Loading shape of /ds: the header and the shape the page shows while its body loads (DS_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={DS_SHAPE.overview} />;
}
