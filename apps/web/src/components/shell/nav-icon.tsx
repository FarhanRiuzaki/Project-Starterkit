import { Icon, type IconData } from "@starterkit/ui/ui/icon";
import { ActiveUserIcon, AllUsersIcon, IdentityIcon, InactiveUserIcon, KeyIcon, LogIcon, OverviewIcon, SecureIcon, SessionsIcon, SurfacesIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import type { NavIcon } from "@/lib/shared/nav";

const MAP = {
  dashboard: OverviewIcon, users: UsersIcon, roles: KeyIcon, permissions: SecureIcon, activity: LogIcon, signin: SessionsIcon,
  ds: SurfacesIcon, profile: IdentityIcon, "users-all": AllUsersIcon, "users-active": ActiveUserIcon, "users-inactive": InactiveUserIcon,
} as const satisfies Record<NavIcon, IconData>;

/** 16 px stroke-1.5 nav icon. */
export function NavGlyph({ icon, className }: { icon: NavIcon; className?: string }) {
  return <Icon icon={MAP[icon]} className={className ?? "size-4"} />;
}
