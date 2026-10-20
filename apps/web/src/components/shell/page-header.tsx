"use client";

import { BlockedButton } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@starterkit/ui/ui/dropdown-menu";
import { Icon } from "@starterkit/ui/ui/icon";
import { MoreIcon, SpinnerIcon } from "@starterkit/ui/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { type TrailCrumb, usePublishTrail } from "@/lib/client/crumb-trail";

/** A secondary header action: a link (`href`) or a command (`onSelect`); `reason` blocks it and says why; `busy` while it runs. */
export type HeaderAction = { label: string; href?: string; onSelect?: () => void; reason?: string | null; destructive?: boolean; busy?: boolean };

/** From 768 px: the action as a secondary (or destructive) button, a BlockedButton when a rule blocks it. */
function ActionButton({ a }: { a: HeaderAction }) {
  const variant = a.destructive ? "destructive" : "secondary";
  if (a.href && !a.reason) return <Button asChild variant={variant}><Link href={a.href}>{a.label}</Link></Button>;
  return (
    <BlockedButton variant={variant} reason={a.reason ?? null} disabled={a.busy} aria-busy={a.busy || undefined} onClick={a.onSelect}>
      {a.busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}{a.label}
    </BlockedButton>
  );
}

/** Below 768 px: the same actions in one "More actions" menu (a deferred overlay); a blocked one is off with its reason. */
function MoreMenu({ actions }: { actions: HeaderAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="More actions" className="md:hidden"><Icon icon={MoreIcon} /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {actions.map((a) => {
          const off = !!a.reason || !!a.busy;
          const body = <span className="grid min-w-0"><span>{a.label}</span>{a.reason && <span className="text-caption text-fg-3">{a.reason}</span>}</span>;
          return a.href && !off
            ? <DropdownMenuItem key={a.label} asChild variant={a.destructive ? "destructive" : "default"}><Link href={a.href}>{body}</Link></DropdownMenuItem>
            : <DropdownMenuItem key={a.label} disabled={off} onSelect={a.onSelect} variant={a.destructive ? "destructive" : "default"}>{body}</DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Page header (ui-standard §1): `title-1` title, optional status next to it, actions right (one primary action),
 * one sentence of scope under the title. On a sub-page the title is also the top bar breadcrumb's last crumb, after the
 * nav page and any parents in `trail` ("Users / Rina Wulandari / Edit user"). Title and description wrap (a long
 * name or email breaks anywhere rather than widening the page). `actions` stay visible at every width; `more`
 * (secondary actions) follow them as buttons from 768 px and fold into a "More actions" menu below, both in the server
 * HTML and switched by CSS.
 */
export function PageHeader({ title, status, actions, more, description, trail = [] }: {
  title: string; status?: ReactNode; actions?: ReactNode; more?: HeaderAction[]; description?: string; trail?: TrailCrumb[];
}) {
  usePublishTrail(usePathname(), [...trail, { label: title }]);
  const extra = more?.length ? more : null;
  return (
    <header className="flex flex-wrap items-start gap-x-3 gap-y-3">
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-title-1 wrap-anywhere text-fg">{title}</h1>
          {status}
        </div>
        {description && <p className="max-w-[72ch] text-body-sm wrap-anywhere text-fg-3">{description}</p>}
      </div>
      {(actions || extra) && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
          {extra && <>
            <div className="contents max-md:hidden">{extra.map((a) => <ActionButton key={a.label} a={a} />)}</div>
            <MoreMenu actions={extra} />
          </>}
        </div>
      )}
    </header>
  );
}
