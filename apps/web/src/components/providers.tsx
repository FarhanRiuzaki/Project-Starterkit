"use client";

import { TooltipProvider } from "@starterkit/ui/ui/tooltip";
import { ThemeProvider } from "next-themes";
import dynamic from "next/dynamic";
import { useEffect } from "react";

/** sonner loads after hydration, not in the first load; toasts only follow user actions, so it is ready in time. */
const Toaster = dynamic(() => import("@starterkit/ui/ui/sonner").then((m) => m.Toaster), { ssr: false });

/** Root providers (every page, sign-in included): theme, tooltips, toasts. `nonce` goes on next-themes' inline script. */
export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // The root has committed: a press kept by the inline script (lib/shared/early-press.ts) may now be pressed again.
  useEffect(() => { (window as { __earlyPressCommitted?: () => void }).__earlyPressCommitted?.(); }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      <TooltipProvider>
        {children}
        <Toaster richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}
