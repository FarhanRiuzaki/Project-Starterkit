"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { setCsrf } from "@/lib/client/api";
import type { UserDto } from "@starterkit/shared/contracts/users";
import type { PermissionName } from "@starterkit/shared/permissions";

type Auth = { user: UserDto; perms: ReadonlySet<PermissionName>; can: (p: PermissionName) => boolean };
const Ctx = createContext<Auth | null>(null);

/** Signed-in viewer for the (main) layout: the user, their permissions (for UI hints only; the server enforces) and the CSRF token. */
export function AuthProvider({ user, perms, csrf, children }: { user: UserDto; perms: readonly PermissionName[]; csrf: string; children: ReactNode }) {
  // During render, not in an effect: children's effects (first queries) run before the provider's. Browser only: the
  // server module is shared by all requests.
  if (typeof window !== "undefined") setCsrf(csrf);
  const set = useMemo(() => new Set(perms), [perms]);
  const can = useCallback((p: PermissionName) => set.has(p), [set]);
  const value = useMemo(() => ({ user, perms: set, can }), [user, set, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
