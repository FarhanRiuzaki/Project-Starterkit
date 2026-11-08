import { RouteSkeleton } from "@/components/route-skeleton";
import { PROJECT_FORM_SHAPE } from "@/features/projects/shapes";

/** Loading shape of /projects/[id]/edit: the same sections the screen shows while its data loads (PROJECT_FORM_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={PROJECT_FORM_SHAPE} />;
}
