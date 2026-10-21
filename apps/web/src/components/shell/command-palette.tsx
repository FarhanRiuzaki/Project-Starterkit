"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { usePrefs } from "@/lib/client/prefs-context";
import { navFor } from "@/lib/shared/nav";
import { viewHref } from "@/lib/shared/prefs";
import { isHelpKey, matchSequence } from "@/lib/shared/shortcuts";

export const OPEN_PALETTE = "sk:open-palette";
export const OPEN_SHORTCUTS = "sk:open-shortcuts";
/** Opens the palette from a button (the sidebar's search field, the phone bar's search icon). */
export const openPalette = () => window.dispatchEvent(new CustomEvent(OPEN_PALETTE));
/** Opens the keyboard shortcut list from a menu item (account menu, palette). */
export const openShortcuts = () => window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS));
const editable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
/** cmdk + the dialog load on the first ⌘K / search click, not with the page. */
const PaletteDialog = dynamic(() => import("./palette-dialog").then((m) => m.PaletteDialog), { ssr: false });
const ShortcutsDialog = dynamic(() => import("./shortcuts-dialog").then((m) => m.ShortcutsDialog), { ssr: false });

/**
 * ⌘K / Ctrl+K opens the page palette; outside inputs "G <letter>" goes to a page and "?" lists the shortcuts, unless the
 * viewer turned single-key shortcuts off (prefs `keys`, WCAG 2.1.4).
 */
export function CommandPalette() {
  const { perms } = useAuth();
  const { prefs } = usePrefs();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [help, setHelp] = useState(false);
  const [helpUsed, setHelpUsed] = useState(false);
  const router = useRouter();
  const prev = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const items = navFor(perms).flatMap((s) => s.items);
    const onOpen = () => { setUsed(true); setOpen(true); };
    const onHelp = () => { setOpen(false); setHelpUsed(true); setHelp(true); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setUsed(true); setOpen((o) => !o); return; }
      if (editable(e.target) || e.metaKey || e.ctrlKey || e.altKey || prefs.keys === "off") return;
      if (isHelpKey(e)) { e.preventDefault(); onHelp(); return; }
      const seq = matchSequence(prev.current, e.key, Date.now());
      prev.current = { key: e.key, at: Date.now() };
      const hit = seq && items.find((n) => n.shortcut === seq);
      if (hit) { e.preventDefault(); router.push(viewHref(hit.href, prefs)); }
    };
    window.addEventListener(OPEN_PALETTE, onOpen);
    window.addEventListener(OPEN_SHORTCUTS, onHelp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_PALETTE, onOpen); window.removeEventListener(OPEN_SHORTCUTS, onHelp); window.removeEventListener("keydown", onKey);
    };
  }, [router, perms, prefs]);

  return (
    <>
      {used && <PaletteDialog open={open} onOpenChange={setOpen} />}
      {helpUsed && <ShortcutsDialog open={help} onOpenChange={setHelp} />}
    </>
  );
}
