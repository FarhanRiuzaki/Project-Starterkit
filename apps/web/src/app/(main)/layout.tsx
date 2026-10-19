import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { MotionLayer, PageTransitionRoot } from "@starterkit/ui/motion";
import { QueryProvider } from "@/components/query-provider";
import { AppShell } from "@/components/shell/app-shell";
import { AuthProvider } from "@/lib/client/auth-context";
import { PrefsProvider } from "@/lib/client/prefs-context";
import { requirePagePermission } from "@/lib/server/page-guard";
import { pagePerm } from "@/lib/shared/nav";
import { PREFS_COOKIE, parsePrefs } from "@/lib/shared/prefs";

/**
 * Signed-in frame: no session → sign-in; a page the role can't open → a real 404 on a document load (pagePerm, checked
 * here before anything streams; the page's own guard covers client navigations); then auth context (user,
 * permissions, CSRF token), prefs, query client, shell.
 * MotionLayer: the deferred Framer layer (loaded after idle, never in first-load JS); PageTransitionRoot: the page
 * crossfade around the page slot once it is loaded (the CSS enter in template.tsx until then).
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, perms, csrf } = await requirePagePermission(null);
  // Document loads only: a client navigation or router.refresh (an RSC request) keeps the shell and lets the page's own
  // guard render "Page not found" inside it.
  const h = await headers();
  const need = pagePerm(h.get("x-pathname") ?? "/");
  if (need && !perms.includes(need) && h.get("rsc") !== "1") notFound();
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  return (
    <AuthProvider user={user} perms={perms} csrf={csrf}>
      <PrefsProvider initial={prefs} secure={process.env.COOKIE_SECURE === "true"}>
        <QueryProvider>
          <MotionLayer>
            <AppShell><PageTransitionRoot>{children}</PageTransitionRoot></AppShell>
          </MotionLayer>
        </QueryProvider>
      </PrefsProvider>
    </AuthProvider>
  );
}
