import Link from "next/link";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { NotFoundIcon } from "@starterkit/ui/ui/icons";

/**
 * "Page not found" with the way back. `app/not-found.tsx` centers it on the app background (an address that matches
 * no page); `app/(main)/not-found.tsx` shows it inside the shell (a page the role can't open). No client code beyond
 * Button, so it adds nothing to a route's first load.
 */
export function NotFoundCard() {
  return (
    <div className="animate-enter grid w-full max-w-100 justify-items-center gap-2 rounded-xl border border-line bg-card p-8 text-center shadow-card">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-tray text-fg-3"><Icon icon={NotFoundIcon} className="size-5" /></span>
      <h1 className="text-title-3 text-fg">Page not found</h1>
      <p className="max-w-[40ch] text-body-sm text-fg-3">The address doesn&apos;t match a page, or you don&apos;t have access to it. Check the link, or go to the dashboard.</p>
      <Button variant="secondary" className="mt-2" asChild><Link href="/">Go to dashboard</Link></Button>
    </div>
  );
}
