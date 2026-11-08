"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { type Palette, paletteCookie, parsePalette } from "@/lib/shared/palette";

const Context = createContext<{ palette: Palette; change: (value: string) => void } | null>(null);

export function PaletteProvider({ initial, secure, children }: { initial: Palette; secure: boolean; children: ReactNode }) {
  const [palette, setPalette] = useState(initial);
  function change(value: string) {
    const next = parsePalette(value);
    setPalette(next);
    document.documentElement.dataset.palette = next;
    document.cookie = paletteCookie(next, secure);
  }
  return <Context.Provider value={{ palette, change }}>{children}</Context.Provider>;
}

export function usePalette() {
  const context = useContext(Context);
  if (!context) throw new Error("PaletteProvider is required");
  return context;
}
