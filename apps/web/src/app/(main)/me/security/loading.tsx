import { RouteSkeleton } from "@/components/route-skeleton";
import { SECURITY_SHAPE } from "@/features/me/shapes";

/** Loading shape of /me/security: the same sections the screen shows while its data loads (SECURITY_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={SECURITY_SHAPE} />;
}
