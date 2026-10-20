import type { Health } from "@starterkit/ui/lib/status";
import type { UserDto } from "@starterkit/shared/contracts/users";

/** One mapping for the status chip on every user screen: inactive = turned off on purpose (stopped). */
export function userStatus(u: UserDto): { health: Health; label: "Active" | "Inactive" } {
  return u.isActive ? { health: "healthy", label: "Active" } : { health: "stopped", label: "Inactive" };
}
