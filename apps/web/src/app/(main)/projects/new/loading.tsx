import { RouteSkeleton } from "@/components/route-skeleton";
import { PROJECT_FORM_SHAPE } from "@/features/projects/shapes";

/** Loading shape of /projects/new: the same sections as the screen (PROJECT_FORM_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={PROJECT_FORM_SHAPE} />;
}
