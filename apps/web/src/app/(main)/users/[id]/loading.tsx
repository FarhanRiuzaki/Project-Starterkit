import { RouteSkeleton } from "@/components/route-skeleton";
import { USER_DETAIL_SHAPE } from "@/features/users/shapes";

/** Loading shape of /users/[id]: the same sections the screen shows while its data loads (USER_DETAIL_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={USER_DETAIL_SHAPE} />;
}
