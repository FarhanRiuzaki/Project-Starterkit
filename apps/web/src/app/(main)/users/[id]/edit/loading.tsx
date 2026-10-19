import { RouteSkeleton } from "@/components/route-skeleton";
import { EDIT_USER_SHAPE } from "@/features/users/user-form";

/** Loading shape of /users/[id]/edit: the same sections the screen shows while its data loads (EDIT_USER_SHAPE). */
export default function Loading() {
  return <RouteSkeleton sections={EDIT_USER_SHAPE} />;
}
