"use client";

import { Kbd } from "@starterkit/ui/ds";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@starterkit/ui/ui/command";
import { Icon } from "@starterkit/ui/ui/icon";
import { ShortcutsIcon } from "@starterkit/ui/ui/icons";
import { Dialog, DialogContent, DialogTitle } from "@starterkit/ui/ui/dialog";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth-context";
import { usePrefs } from "@/lib/client/prefs-context";
import { navFor } from "@/lib/shared/nav";
import { viewHref } from "@/lib/shared/prefs";
import { goKeys } from "@/lib/shared/shortcuts";
import { openShortcuts } from "./command-palette";
import { NavGlyph } from "./nav-icon";

const PLACEHOLDER = "Search pages";

/**
 * The ⌘K dialog (cmdk). Loaded on first open by CommandPalette, so cmdk is not in any route's first load. On a phone it
 * hangs from the top edge (`phone="top"`), its results at most half the screen, so the keyboard doesn't cover them.
 */
export function PaletteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { perms } = useAuth();
  const { prefs } = usePrefs();
  const go = (href: string) => { onOpenChange(false); router.push(viewHref(href, prefs)); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent phone="top" showCloseButton={false} className="top-24 translate-y-0 p-0 md:max-w-xl">
        <DialogTitle className="sr-only">Search pages</DialogTitle>
        <Command label="Command palette">
          <CommandInput placeholder={PLACEHOLDER} aria-label={PLACEHOLDER} />
          <CommandList className="max-md:max-h-[50dvh]">
            <CommandEmpty>No pages match.</CommandEmpty>
            <CommandGroup heading="Pages">
              {navFor(perms).flatMap((s) => s.items).map((n) => (
                <CommandItem key={n.href} value={`${n.label} ${n.href}`} onSelect={() => go(n.href)}>
                  <NavGlyph icon={n.icon} />{n.label}{n.shortcut && <span className="ml-auto"><Kbd keys={goKeys(n.shortcut)} /></span>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Help">
              <CommandItem value="Keyboard shortcuts" onSelect={() => { onOpenChange(false); openShortcuts(); }}>
                <Icon icon={ShortcutsIcon} />Keyboard shortcuts<span className="ml-auto"><Kbd keys={["?"]} /></span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
