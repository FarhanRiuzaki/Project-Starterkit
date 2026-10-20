"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { usePrefs } from "@/lib/client/prefs-context";
import { navFor } from "@/lib/shared/nav";
import { viewHref } from "@/lib/shared/prefs";
import { matchSequence } from "@/lib/shared/shortcuts";

export const OPEN_PALETTE = "sk:open-palette";
const editable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
/** cmdk + the dialog load on the first ⌘K / search click, not with the page. */
const PaletteDialog = dynamic(() => import("./palette-dialog").then((m) => m.PaletteDialog), { ssr: false });

/** ⌘K / Ctrl+K opens the page palette; "G <letter>" shortcuts go to a page outside inputs. */
export function CommandPalette() {
  const { perms } = useAuth();
  const { prefs } = usePrefs();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const router = useRouter();
  const prev = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const items = navFor(perms).flatMap((s) => s.items);
    const onOpen = () => { setUsed(true); setOpen(true); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setUsed(true); setOpen((o) => !o); return; }
      if (editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const seq = matchSequence(prev.current, e.key, Date.now());
      prev.current = { key: e.key, at: Date.now() };
      const hit = seq && items.find((n) => n.shortcut === seq);
      if (hit) { e.preventDefault(); router.push(viewHref(hit.href, prefs)); }
    };
    window.addEventListener(OPEN_PALETTE, onOpen);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(OPEN_PALETTE, onOpen); window.removeEventListener("keydown", onKey); };
  }, [router, perms, prefs]);

  return used ? <PaletteDialog open={open} onOpenChange={setOpen} /> : null;
}
