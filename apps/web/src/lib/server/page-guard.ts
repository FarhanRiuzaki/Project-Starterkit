import "server-only";
import { signInHref } from "@starterkit/ui/lib/safe-path";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { UserDto } from "@/lib/shared/contracts/users";
import type { PermissionName } from "@/lib/shared/permissions";
import { toUserDto } from "./mock/db";
import { authOf, getSession } from "./session";

/**
 * Page guard for server components (layouts, pages). No live session → sign-in, returning to the requested path
 * (proxy.ts sets `x-pathname`; signInHref keeps it only when internal). Missing permission → "Page not found", with
 * no hint that the page exists. Returns what the shell needs: the user (as a DTO), permissions, and the CSRF token.
 */
export async function requirePagePermission(
  perm: PermissionName | null,
): Promise<{ user: UserDto; perms: PermissionName[]; csrf: string }> {
  const s = await getSession();
  const ctx = authOf(s);
  if (!ctx) redirect(signInHref((await headers()).get("x-pathname")));
  if (perm && !ctx.perms.has(perm)) notFound();
  return { user: toUserDto(ctx.user), perms: [...ctx.perms], csrf: s.csrf! };
}
