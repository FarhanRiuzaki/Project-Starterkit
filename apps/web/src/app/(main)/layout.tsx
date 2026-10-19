import { cookies } from "next/headers";
import { MotionLayer, PageTransitionRoot } from "@starterkit/ui/motion";
import { QueryProvider } from "@/components/query-provider";
import { AppShell } from "@/components/shell/app-shell";
import { AuthProvider } from "@/lib/client/auth-context";
import { PrefsProvider } from "@/lib/client/prefs-context";
import { requirePagePermission } from "@/lib/server/page-guard";
import { PREFS_COOKIE, parsePrefs } from "@/lib/shared/prefs";

/**
 * Signed-in frame: no session → sign-in; then auth context (user, permissions, CSRF token), prefs, query client, shell.
 * MotionLayer: the deferred Framer layer (loaded after idle, never in first-load JS); PageTransitionRoot: the page
 * crossfade around the page slot once it is loaded (the CSS enter in template.tsx until then).
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, perms, csrf } = await requirePagePermission(null);
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
