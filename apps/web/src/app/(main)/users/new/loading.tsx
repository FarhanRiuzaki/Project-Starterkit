import { RouteSkeleton } from "@/components/route-skeleton";
import { CREATE_USER_SHAPE } from "@/features/users/shapes";

/** Loading shape of /users/new: the same sections as the screen (CREATE_USER_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={CREATE_USER_SHAPE} />;
}
