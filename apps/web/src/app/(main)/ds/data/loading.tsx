import { RouteSkeleton } from "@/components/route-skeleton";
import { DS_SHAPE } from "@/features/ds/shapes";

/** Loading shape of /ds/data: its first screen (DS_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={DS_SHAPE.data} />;
}
