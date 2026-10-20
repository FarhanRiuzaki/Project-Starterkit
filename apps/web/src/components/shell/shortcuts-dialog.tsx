"use client";

import { Kbd } from "@starterkit/ui/ds";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@starterkit/ui/ui/dialog";
import { Switch } from "@starterkit/ui/ui/switch";
import { useAuth } from "@/lib/client/auth-context";
import { usePrefs } from "@/lib/client/prefs-context";
import { navFor } from "@/lib/shared/nav";
import { goKeys } from "@/lib/shared/shortcuts";

const Row = ({ label, keys, said }: { label: string; keys: string[]; said: string }) => (
  <div className="flex min-h-9 items-center justify-between gap-4 border-b border-line py-1.5 last:border-b-0">
    <dt className="text-body text-fg">{label}</dt>
    <dd className="flex items-center gap-1.5"><Kbd keys={keys} /><span className="sr-only">{said}</span></dd>
  </div>
);

/**
 * Every keyboard shortcut of the console (GitHub, Linear: "?" lists them), the "Go to" ones only for the pages the
 * viewer can open, and the switch for single-key shortcuts (WCAG 2.1.4). Loaded on first open (CommandPalette).
 */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { perms } = useAuth();
  const { prefs, update } = usePrefs();
  const on = prefs.keys !== "off";
  const pages = navFor(perms).flatMap((s) => s.items).filter((n) => n.shortcut);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] md:max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>They work anywhere outside a text field.</DialogDescription>
        </DialogHeader>
        <div className="scroll-quiet grid min-h-0 gap-5 overflow-y-auto px-6 pb-6">
          <section className="grid gap-1">
            <h3 className="text-label text-fg-3">General</h3>
            <dl>
              <Row label="Search pages" keys={["⌘", "K"]} said="Command or Control plus K" />
              <Row label="Show keyboard shortcuts" keys={["?"]} said="Question mark" />
              <Row label="Close a dialog or menu" keys={["Esc"]} said="Escape" />
            </dl>
          </section>
          {pages.length > 0 && (
            <section className="grid gap-1">
              <h3 className="text-label text-fg-3">Go to</h3>
              <dl>{pages.map((n) => <Row key={n.href} label={n.label} keys={goKeys(n.shortcut)} said={`${goKeys(n.shortcut).join(" then ")}`} />)}</dl>
            </section>
          )}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-tray px-3 py-2.5">
            <span className="grid gap-0.5">
              <span id="keys-label" className="text-body text-fg">Single-key shortcuts</span>
              <span id="keys-note" className="text-caption text-fg-3">G then a letter, and ?. Turn them off if they get in the way of a screen reader or voice control.</span>
            </span>
            <Switch checked={on} onChange={(v) => update({ keys: v ? "on" : "off" })} label="Single-key shortcuts" describedBy="keys-note" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
