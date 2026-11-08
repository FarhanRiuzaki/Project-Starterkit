import { RouteSkeleton } from "@/components/route-skeleton";
import { PROJECT_DETAIL_SHAPE } from "@/features/projects/shapes";

/** Loading shape of /projects/[id]: the same sections the screen shows while its data loads (PROJECT_DETAIL_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={PROJECT_DETAIL_SHAPE} />;
}
