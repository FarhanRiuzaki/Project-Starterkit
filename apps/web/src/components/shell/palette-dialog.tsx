"use client";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@starterkit/ui/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@starterkit/ui/ui/dialog";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth-context";
import { navFor } from "@/lib/shared/nav";
import { NavGlyph } from "./nav-icon";

const PLACEHOLDER = "Search pages";

/** The ⌘K dialog (cmdk). Loaded on first open by CommandPalette, so cmdk is not in any route's first load. */
export function PaletteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { perms } = useAuth();
  const go = (href: string) => { onOpenChange(false); router.push(href); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-24 translate-y-0 p-0 md:max-w-xl">
        <DialogTitle className="sr-only">Search pages</DialogTitle>
        <Command label="Command palette">
          <CommandInput placeholder={PLACEHOLDER} aria-label={PLACEHOLDER} />
          <CommandList>
            <CommandEmpty>No pages match.</CommandEmpty>
            <CommandGroup heading="Pages">
              {navFor(perms).flatMap((s) => s.items).map((n) => (
                <CommandItem key={n.href} value={`${n.label} ${n.href}`} onSelect={() => go(n.href)}>
                  <NavGlyph icon={n.icon} />{n.label}{n.shortcut && <span className="ml-auto font-mono text-caption text-fg-3">{n.shortcut}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
