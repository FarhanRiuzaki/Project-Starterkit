"use client";

import { Panel } from "@starterkit/ui/ds";
import { PageError } from "@/components/page-error";

/** A page that failed while rendering, shown inside the shell (the sidebar and top bar stay usable). */
export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid gap-section">
      <h1 className="text-title-1 text-fg">Page unavailable</h1>
      <Panel flush><PageError error={error} reset={reset} /></Panel>
    </div>
  );
}
