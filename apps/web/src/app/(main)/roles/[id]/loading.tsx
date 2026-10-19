import { RouteSkeleton } from "@/components/route-skeleton";
import { ROLE_DETAIL_SHAPE } from "@/features/rbac/shapes";

/** Loading shape of /roles/[id]: the same sections the screen shows while its data loads (ROLE_DETAIL_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={ROLE_DETAIL_SHAPE} />;
}
