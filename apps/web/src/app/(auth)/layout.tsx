import { redirect } from "next/navigation";
import { authContext } from "@/lib/server/session";

/** Public sign-in pages; someone already fully signed in goes to the dashboard. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await authContext()) redirect("/");
  return <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">{children}</main>;
}
