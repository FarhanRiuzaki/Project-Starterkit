import "server-only";
import { signInHref } from "@starterkit/ui/lib/safe-path";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { UserDto } from "@starterkit/shared/contracts/users";
import { pagePerm } from "@/lib/shared/nav";
import type { PermissionName } from "@starterkit/shared/permissions";
import { authContext, getSession } from "./session";

/**
 * Page guard for server components (layouts, pages). No live session → sign-in, returning to the requested path
 * (proxy.ts sets `x-pathname`; signInHref keeps it only when internal). Missing permission → "Page not found", with
 * no hint that the page exists. Returns what the shell needs: the user, permissions, and the CSRF token. The user and
 * permissions come from authContext (one API call per request, shared with the layout and the title).
 */
export async function requirePagePermission(
  perm: PermissionName | null,
): Promise<{ user: UserDto; perms: PermissionName[]; csrf: string }> {
  const ctx = await authContext();
  if (!ctx) redirect(signInHref((await headers()).get("x-pathname")));
  if (perm && !ctx.perms.includes(perm)) notFound();
  return { user: ctx.user, perms: ctx.perms, csrf: (await getSession()).csrf! };
}

/**
 * Metadata of a guarded page: its own title only for a viewer who may open it (pagePerm of the requested path); for
 * anyone else "Page not found", so neither the 404 answer nor the tab names the page.
 */
export async function guardedTitle(title: string): Promise<Metadata> {
  const need = pagePerm((await headers()).get("x-pathname") ?? "/");
  const ctx = need ? await authContext() : null;
  return { title: !need || ctx?.perms.includes(need) ? title : "Page not found" };
}
