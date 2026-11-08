import { redirect } from "next/navigation";
import { authContext } from "@/lib/server/session";
import { SunnyGoWordmark } from "@/components/brand";
import { BRAND } from "@starterkit/shared/brand";

/** Public sign-in pages; someone already fully signed in goes to the dashboard. The padding grows to a phone's safe-area insets (viewport-fit=cover). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await authContext()) redirect("/");
  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-clip bg-sheet px-6 py-8 md:p-8">
      {/* CSS requests only the active theme's artwork; hidden img elements fetch both files. */}
      <div aria-hidden="true" className="auth-landscape pointer-events-none absolute inset-0 -z-10" />
      <header className="relative mx-auto flex w-full max-w-320 py-5 md:py-10"><SunnyGoWordmark className="w-30.5" /></header>
      <div className="relative mx-auto grid w-full max-w-308 flex-1 items-start gap-10 py-6 md:grid-cols-2 md:gap-12 md:py-4 xl:gap-24">
        <div className="grid gap-6 pt-4 max-md:hidden xl:pt-23">
          <p className="text-display xl:text-welcome">Your team.<br />One clear view.</p>
          <p className="max-w-100 text-body text-fg-2">Manage users, access, and activity in {BRAND.name}.</p>
        </div>
        <div className="flex min-w-0 justify-center md:justify-end xl:pr-10">{children}</div>
      </div>
      <footer className="relative mx-auto w-full max-w-320 pt-8 text-caption text-fg-3">{BRAND.name}</footer>
    </main>
  );
}
