"use client";

import { ErrorState } from "@starterkit/ui/ds";
import { BRAND } from "@starterkit/shared/brand";
import { fontVariables } from "./fonts";
import "./globals.css";

/** Last-resort boundary (the root layout itself failed): own <html>/<body>, with a retry. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-bg font-sans">
        <main className="grid min-h-screen place-items-center px-4 py-10">
          <div className="grid w-full max-w-100 gap-2 rounded-xl border border-line bg-card p-8 shadow-card">
            <h1 className="text-center text-title-3 text-fg">{BRAND.name}</h1>
            <ErrorState title="Couldn't load the app"
              cause="The app hit an unexpected error while loading. Try again; if it continues, contact your administrator."
              detail={error.digest ? `Reference ${error.digest}` : null} onRetry={retry} />
          </div>
        </main>
      </body>
    </html>
  );
}
