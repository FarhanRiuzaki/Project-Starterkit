"use client";

import { PageError } from "@/components/page-error";

/**
 * Errors outside the shell: a sign-in page, or the signed-in layout itself (its own error.tsx sits inside it). The
 * root layout stays; global-error.tsx is only for a failure of the root layout. Same card as not-found.tsx.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="grid w-full max-w-100 rounded-xl border border-line bg-card p-4 shadow-card">
        <PageError error={error} reset={reset} />
      </div>
    </main>
  );
}
