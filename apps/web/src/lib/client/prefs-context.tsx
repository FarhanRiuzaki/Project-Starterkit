"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { type Prefs, prefsCookie } from "@/lib/shared/prefs";

const Ctx = createContext<{ prefs: Prefs; update: (patch: Partial<Prefs>) => void } | null>(null);

/** Viewer preferences (sidebar, density) kept in a cookie, so the server renders the right layout on the next load. */
export function PrefsProvider({ initial, secure, children }: { initial: Prefs; secure: boolean; children: ReactNode }) {
  const [prefs, setPrefs] = useState(initial);
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      document.cookie = prefsCookie(next, secure);
      document.documentElement.dataset.density = next.density;
      return next;
    });
  }, [secure]);
  const value = useMemo(() => ({ prefs, update }), [prefs, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs must be used inside PrefsProvider");
  return v;
}
