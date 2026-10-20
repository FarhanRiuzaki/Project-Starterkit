"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@starterkit/ui/ui/dropdown-menu";
import { Icon } from "@starterkit/ui/ui/icon";
import { ViewsIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { toast } from "@starterkit/ui/ui/toast";
import { LazyConfirmActionDialog } from "@/components/lazy-confirm";
import { api, errorText } from "@/lib/client/api";
import type { Page } from "@starterkit/shared/contracts/common";
import type { SavedViewDto } from "@starterkit/shared/contracts/me";
import { savedViews } from "@/lib/shared/queries";
import { viewLink, viewQuery } from "@/lib/shared/saved-views";

/**
 * Saved views of a list page (Polaris IndexFilters, Fiori variant management): a "Views" button in the toolbar, named
 * after the view on screen when it is a saved one ("View: Inactive admins"); its menu opens a saved view, saves the
 * current search, filters, sort and rows per page under a name ("Save view as…"), and deletes the open one (with
 * Undo). Per user, on the server (GET/POST/DELETE /api/me/views), so they follow the user to any device. The list loads
 * when the menu first opens: nothing is fetched with the page.
 */
export function SavedViewsMenu() {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const { key, url } = savedViews(path);
  const q = useQuery({ queryKey: key, queryFn: () => api<Page<SavedViewDto>>(url), enabled: opened });
  const here = viewQuery(new URLSearchParams(sp.toString()));
  const current = q.data?.items.find((v) => viewQuery(new URLSearchParams(v.query)) === here) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function save() {
    const v = await api<SavedViewDto>("/api/me/views", { method: "POST", body: JSON.stringify({ path, name: name.trim(), query: here }) });
    toast(`Saved view “${v.name}”.`);
    await refresh();
  }
  async function remove(v: SavedViewDto) {
    try {
      await api(`/api/me/views/${v.id}`, { method: "DELETE" });
      toast.undo(`Deleted view “${v.name}”.`, () => void api("/api/me/views", { method: "POST", body: JSON.stringify({ path, name: v.name, query: v.query }) }).then(refresh));
    } catch (e) { toast.error(errorText(e)); }
    await refresh();
  }

  return (
    <>
      <DropdownMenu onOpenChange={(o) => { if (o) setOpened(true); }}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" aria-label={current ? `Views, ${current.name} open` : "Views"} className="gap-1.5 px-2.5 text-body-sm font-normal">
            <Icon icon={ViewsIcon} className="size-4 text-fg-3" />
            <span className="max-md:sr-only">{current ? <><span className="text-fg-3">View:</span> {current.name}</> : "Views"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          {q.isPending ? <p role="status" className="px-2 py-1.5 text-body-sm text-fg-3">Loading your views…</p>
            : q.error ? <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void q.refetch(); }}>Couldn&apos;t load your views. Try again</DropdownMenuItem>
            : q.data.items.length === 0 ? <p className="px-2 py-1.5 text-body-sm text-fg-3">No saved views yet. Save this list&apos;s search and filters to come back to them.</p>
            : (
              <DropdownMenuRadioGroup value={current?.id ?? ""} onValueChange={(id) => { const v = q.data.items.find((x) => x.id === id); if (v) router.push(viewLink(path, v.query)); }}>
                {q.data.items.map((v) => <DropdownMenuRadioItem key={v.id} value={v.id} className="truncate">{v.name}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { setName(""); setSaving(true); }}>Save view as…</DropdownMenuItem>
          {current && <DropdownMenuItem variant="destructive" onSelect={() => void remove(current)}>Delete “{current.name}”</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      {saving && (
        <LazyConfirmActionDialog open onOpenChange={(o) => { if (!o) setSaving(false); }} auditFields={false} reasons={[]} title="Save view"
          description="Keeps this list's search, filters, sort and rows per page under a name. Only you see it."
          impact={["It appears under Views on this page, on any device you sign in on."]} actionLabel="Save view"
          onConfirm={async () => {
            if (!name.trim()) throw new Error("Enter a name for the view.");
            await save();
          }}
          lead={<Field id="view-name" label="Name" note="Up to 40 characters, different from your other views here.">
            <Input id="view-name" value={name} maxLength={40} autoFocus autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </Field>} />
      )}
    </>
  );
}
