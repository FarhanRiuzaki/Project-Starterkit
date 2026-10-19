import type { ReactNode } from "react";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * App frame, desktop only: the sidebar sits on --bg; the content lives in one sheet (radius 16, 1 px line, 8 px from
 * the sidebar and the window edges) with the 56 px top bar; content padding 24 top / 32 sides / 40 bottom, max 1376 px
 * and centred. The sidebar and the nav read the viewer from `useAuth`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-bg">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-overlay">Skip to content</a>
      <Sidebar />
      <div className="animate-shell-sheet my-2 mr-2 ml-2 flex min-h-sheet min-w-0 flex-1 flex-col rounded-xl bg-sheet ring-1 ring-line print:m-0 print:ring-0">
        <TopBar />
        <main id="content" className="flex min-w-0 flex-1 flex-col px-8 pt-6 pb-10 print:p-0">
          <div className="mx-auto grid w-full max-w-344 min-w-0 gap-section">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
