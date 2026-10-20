import type { ReactNode } from "react";
import { SunnyGoMark, SunnyGoWordmark } from "@/components/brand";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * App frame: the sidebar sits on --bg; the content lives in one sheet (radius 16, 1 px line, 8 px from the sidebar and
 * the window edges) with the 56 px top bar; content padding 24 top / 32 sides / 40 bottom, max 1376 px and centred.
 * Below 768 px (design-system §0): no sidebar (the top bar's menu opens it as a drawer), the sheet fills the window
 * edge to edge and the content padding is 16 px. Safe-area insets left and right (a phone on its side). The sidebar
 * and the nav read the viewer from `useAuth`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-bg px-safe">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-overlay">Skip to content</a>
      {/* Mark 28 px in the 64 px rail; wordmark 104 px in the 248 px sidebar header. */}
      <Sidebar mark={<SunnyGoMark className="size-7" />} wordmark={<SunnyGoWordmark className="w-26" />} />
      <div className="animate-shell-sheet my-2 mr-2 ml-2 flex min-h-sheet min-w-0 flex-1 flex-col rounded-xl bg-sheet ring-1 ring-line max-md:m-0 max-md:min-h-svh max-md:rounded-none max-md:ring-0 print:m-0 print:ring-0">
        <TopBar mark={<SunnyGoMark className="size-7" />} wordmark={<SunnyGoWordmark className="w-26" />} />
        <main id="content" className="flex min-w-0 flex-1 flex-col px-8 pt-6 pb-10 max-md:px-4 max-md:pt-4 print:p-0">
          <div className="mx-auto grid w-full max-w-344 min-w-0 gap-section">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
