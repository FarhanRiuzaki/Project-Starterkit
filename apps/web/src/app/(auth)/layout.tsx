import { redirect } from "next/navigation";
import { authOf, getSession } from "@/lib/server/session";

/** Public sign-in pages; someone already fully signed in goes to the dashboard. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (authOf(await getSession())) redirect("/");
  return <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">{children}</main>;
}
