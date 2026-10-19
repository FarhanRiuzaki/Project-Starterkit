import { RouteSkeleton } from "@/components/route-skeleton";
import { PROFILE_SHAPE } from "@/features/me/shapes";

/** Loading shape of /me: the same sections the screen shows while its data loads (PROFILE_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={PROFILE_SHAPE} />;
}
