"use client";

import { Icon } from "../ui/icon";
import { MoreIcon } from "../ui/icons";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";

type Action = { id: string; label: string; destructive?: boolean; disabled?: boolean; hint?: string; onSelect?: () => void };

/** Admin action menu. `unavailableReason` (obs-agent down, or still checking) disables every item and says why at the
 *  top; an item's `hint` explains why that item alone is disabled. */
export function ActionMenu({ label, actions, unavailableReason }: { label: string; actions: Action[]; unavailableReason?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} data-slot="action-menu-trigger"><Icon icon={MoreIcon} /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {unavailableReason && <><DropdownMenuLabel className="text-label font-normal text-fg-3">{unavailableReason}</DropdownMenuLabel><DropdownMenuSeparator /></>}
        {actions.map((a) => (
          <DropdownMenuItem key={a.id} disabled={!!unavailableReason || a.disabled || !a.onSelect} onSelect={a.onSelect}
            variant={a.destructive ? "destructive" : "default"}>
            <span className="grid min-w-0"><span>{a.label}</span>{a.hint && !unavailableReason && <span className="text-caption text-fg-3">{a.hint}</span>}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
