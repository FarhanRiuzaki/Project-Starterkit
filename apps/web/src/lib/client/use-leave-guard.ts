"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Unsaved changes: while `dirty`, the browser asks before a reload or closing the tab (beforeunload), and a click on
 * an in-app link is held: `leaving` is where it pointed, for the screen's ConfirmActionDialog; `leave()` goes there,
 * `stay()` closes the question. Limits: Back/Forward and programmatic navigation (the command palette) aren't held.
 */
export function useLeaveGuard(dirty: boolean): { leaving: string | null; stay: () => void; leave: () => void } {
  const router = useRouter();
  const [leaving, setLeaving] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    // Capture phase on the document: runs before Next's Link handler (React listens on the root, below the document).
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaving(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  return {
    leaving,
    stay: () => setLeaving(null),
    leave: () => { const to = leaving; setLeaving(null); if (to) router.push(to); },
  };
}
