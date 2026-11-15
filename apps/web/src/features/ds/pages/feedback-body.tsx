"use client";

import { Field, NavigationPreview, Panel, SetupChecklist, type SetupGroup } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@starterkit/ui/ui/dialog";
import { Drawer, DrawerContent, DrawerClose, DrawerTrigger } from "@starterkit/ui/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@starterkit/ui/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@starterkit/ui/ui/command";
import { Input } from "@starterkit/ui/ui/input";
import { toast } from "@starterkit/ui/ui/toast";
import Link from "next/link";
import { useState } from "react";
import { AffectGroup } from "../affect/gallery";
import { sample } from "../sample-toast";
import { SectionTitle } from "../section-title";
import { useHashScroll } from "../use-hash-scroll";

/** /ds/feedback below the header: overlays and toasts, then affectUI's feedback group. */
export function FeedbackSections() {
  useHashScroll();
  return (
    <>
      <section id="ds-overlays" className="scroll-mt-20"><OverlayExamples /></section>

      <SectionTitle>Setup checklist</SectionTitle>
      <SetupChecklistExamples />

      <AffectGroup id="feedback" />
    </>
  );
}

function OverlayExamples() {
  const [command, setCommand] = useState(false);
  return <Panel title="Overlays and feedback" description="Shared focus handling, Escape dismissal and return to the trigger. All actions use local preview state."><div className="flex flex-wrap gap-3">
    <Dialog><DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Example dialog</DialogTitle><DialogDescription>On a phone this uses the shared bottom-sheet behavior.</DialogDescription></DialogHeader><div className="grid gap-4 px-6 py-5"><Field id="library-dialog-input" label="Example value"><Input id="library-dialog-input" /></Field></div></DialogContent></Dialog>
    <Drawer><DrawerTrigger asChild><Button variant="secondary">Preview navigation drawer</Button></DrawerTrigger><DrawerContent title="Example navigation"><div className="grid gap-4 p-4"><NavigationPreview items={[{ id: "overview", label: "Overview" }, { id: "users", label: "Users" }]} /><DrawerClose asChild><Button variant="secondary">Close drawer</Button></DrawerClose></div></DrawerContent></Drawer>
    <Popover><PopoverTrigger asChild><Button variant="secondary">Open popover</Button></PopoverTrigger><PopoverContent aria-label="Example popover"><p className="text-body-sm">Place supporting information or a small form here.</p></PopoverContent></Popover>
    <Dialog open={command} onOpenChange={setCommand}><DialogTrigger asChild><Button variant="secondary">Open command palette</Button></DialogTrigger><DialogContent phone="top" showCloseButton={false}><DialogTitle className="sr-only">Find an example</DialogTitle><DialogDescription className="sr-only">Search the sample commands.</DialogDescription><Command><CommandInput placeholder="Search examples…" aria-label="Search sample commands" /><CommandList><CommandEmpty>No matching command.</CommandEmpty>{["Overview", "Users", "Settings"].map(label => <CommandItem key={label} onSelect={() => { setCommand(false); sample(); }}>{label}</CommandItem>)}</CommandList></Command></DialogContent></Dialog>
    <Button variant="secondary" onClick={() => toast("Saved example")}>Success toast</Button><Button variant="secondary" onClick={() => toast.error("Couldn't save example", { description: "Your changes are kept. Try again." })}>Error toast</Button><Button variant="secondary" onClick={() => toast.undo("Example archived", () => toast("Example restored"))}>Undo toast</Button>
  </div></Panel>;
}

const link = (href: string, label: string) => <Link href={href}>{label}</Link>;

/** Fictional setup tasks: each action marks its task done in local state; the last one shows the completion message. */
function SetupChecklistExamples() {
  const [done, setDone] = useState<readonly string[]>(["password"]);
  const mark = (id: string) => () => setDone((d) => [...d, id]);
  const has = (id: string) => done.includes(id);
  const groups: SetupGroup[] = [
    { id: "security", label: "Secure your account", tasks: [
      { id: "password", label: "Change the first password", done: has("password") },
      { id: "2fa", label: "Turn on two-factor authentication", description: "A one-time code is asked at every sign-in.", done: has("2fa"), action: { label: "Turn on 2FA", onClick: mark("2fa") } },
    ] },
    { id: "people", label: "Add your team", tasks: [
      { id: "invite", label: "Invite a user", description: "The invitation link works for 72 hours.", done: has("invite"), action: { label: "Invite user", onClick: mark("invite") } },
      { id: "role", label: "Create a role", description: "A role is a named set of permissions.", done: has("role"), action: { label: "Create role", onClick: mark("role") } },
    ] },
    { id: "review", label: "Review activity", tasks: [
      { id: "log", label: "Open the activity log", done: has("log"), action: { label: "Open activity log", onClick: mark("log") } },
    ] },
  ];
  return (
    <section className="grid grid-cols-12 items-start gap-gutter" aria-label="Setup checklist">
      <SetupChecklist className="col-span-12 xl:col-span-6" title="Finish setting up" groups={groups}
        completion={<div className="grid justify-items-start gap-3"><p>Setup is complete. Every task is done.</p><Button type="button" variant="secondary" size="sm" onClick={() => setDone([])}>Reset tasks</Button></div>} />
      <div className="col-span-12 grid gap-gutter xl:col-span-6">
        {/* Links, the caller's progress text, a lower heading level. */}
        <SetupChecklist title="Access setup" headingLevel={3} progressText="1 of 3 tasks done" renderLink={link} groups={[
          { id: "access", label: "Roles and permissions", tasks: [
            { id: "a", label: "Review the Admin role", done: true },
            { id: "b", label: "Create a role for auditors", description: "Give it permission to view the activity log and the sign-in log, and nothing else.", done: false, action: { label: "Create role", href: "/ds/data" } },
            { id: "c", label: "Assign a role to Dewi Lestari", done: false, action: { label: "Open users", href: "/ds/data" } },
          ] },
        ]} />
        {/* One task, no action. */}
        <SetupChecklist title="One step left" headingLevel={3} groups={[{ id: "g", label: "Mail", tasks: [{ id: "smtp", label: "Ask your administrator to set the mail server", done: false }] }]} />
        {/* Every task done from the first paint. */}
        <SetupChecklist title="Setup" headingLevel={3} completion="Setup is complete. You can change any of this in your profile." groups={[
          { id: "g", label: "Security", tasks: [{ id: "x", label: "Turn on two-factor authentication", done: true }] },
        ]} />
      </div>
    </section>
  );
}
