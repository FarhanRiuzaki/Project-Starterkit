import { redirect } from "next/navigation";
import { authContext } from "@/lib/server/session";

/** Public sign-in pages; someone already fully signed in goes to the dashboard. The padding grows to a phone's safe-area insets (viewport-fit=cover). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await authContext()) redirect("/");
  return <main className="flex min-h-screen items-center justify-center bg-bg px-4 pt-[max(calc(var(--spacing)*10),env(safe-area-inset-top))] pb-[max(calc(var(--spacing)*10),env(safe-area-inset-bottom))]">{children}</main>;
}
