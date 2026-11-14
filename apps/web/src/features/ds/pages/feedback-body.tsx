"use client";

import { Field, NavigationPreview, Panel } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@starterkit/ui/ui/dialog";
import { Drawer, DrawerContent, DrawerClose, DrawerTrigger } from "@starterkit/ui/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@starterkit/ui/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@starterkit/ui/ui/command";
import { Input } from "@starterkit/ui/ui/input";
import { toast } from "@starterkit/ui/ui/toast";
import { useState } from "react";
import { AffectGroup } from "../affect/gallery";
import { sample } from "../sample-toast";
import { useHashScroll } from "../use-hash-scroll";

/** /ds/feedback below the header: overlays and toasts, then affectUI's feedback group. */
export function FeedbackSections() {
  useHashScroll();
  return (
    <>
      <section id="ds-overlays" className="scroll-mt-20"><OverlayExamples /></section>

      <AffectGroup id="feedback" />
    </>
  );
}

function OverlayExamples() {
  const [command, setCommand] = useState(false);
  return <Panel title="Overlays and feedback" description="Shared focus handling, Escape dismissal and return to the trigger. All actions use local preview state."><div className="flex flex-wrap gap-3">
    <Dialog><DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger><DialogContent><DialogTitle>Example dialog</DialogTitle><DialogDescription>On a phone this uses the shared bottom-sheet behavior.</DialogDescription><Field id="library-dialog-input" label="Example value"><Input id="library-dialog-input" /></Field></DialogContent></Dialog>
    <Drawer><DrawerTrigger asChild><Button variant="secondary">Preview navigation drawer</Button></DrawerTrigger><DrawerContent title="Example navigation"><div className="grid gap-4 p-4"><NavigationPreview items={[{ id: "overview", label: "Overview" }, { id: "users", label: "Users" }]} /><DrawerClose asChild><Button variant="secondary">Close drawer</Button></DrawerClose></div></DrawerContent></Drawer>
    <Popover><PopoverTrigger asChild><Button variant="secondary">Open popover</Button></PopoverTrigger><PopoverContent aria-label="Example popover"><p className="text-body-sm">Place supporting information or a small form here.</p></PopoverContent></Popover>
    <Dialog open={command} onOpenChange={setCommand}><DialogTrigger asChild><Button variant="secondary">Open command palette</Button></DialogTrigger><DialogContent phone="top"><DialogTitle>Find an example</DialogTitle><DialogDescription>Search the sample commands.</DialogDescription><Command><CommandInput placeholder="Search examples…" aria-label="Search sample commands" /><CommandList><CommandEmpty>No matching command.</CommandEmpty>{["Overview", "Users", "Settings"].map(label => <CommandItem key={label} onSelect={() => { setCommand(false); sample(); }}>{label}</CommandItem>)}</CommandList></Command></DialogContent></Dialog>
    <Button variant="secondary" onClick={() => toast("Saved example")}>Success toast</Button><Button variant="secondary" onClick={() => toast.error("Couldn't save example", { description: "Your changes are kept. Try again." })}>Error toast</Button><Button variant="secondary" onClick={() => toast.undo("Example archived", () => toast("Example restored"))}>Undo toast</Button>
  </div></Panel>;
}
