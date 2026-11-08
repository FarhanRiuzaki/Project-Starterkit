"use client";
import { type ComponentProps, type ReactNode, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ChevronRightIcon, MoreIcon } from "../ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

export type BreadcrumbItem = { id: string; label: string; href?: string };
/** Pure navigation UI; callers can supply their router's Link without a package dependency. */
export function Breadcrumb({ items, collapsed, label = "Breadcrumb", renderLink }: { items: readonly BreadcrumbItem[]; collapsed?: boolean; label?: string; renderLink?: (item: BreadcrumbItem) => ReactNode }) {
  const link = (item: BreadcrumbItem) => renderLink?.(item) ?? <a href={item.href} className="rounded-xs underline underline-offset-4 hover:text-fg">{item.label}</a>;
  const hidden = collapsed && items.length > 3 ? items.slice(1, -1) : [];
  const visible = hidden.length ? [items[0]!, { id: "ellipsis", label: "…" }, items.at(-1)!] : items;
  return <nav data-slot="breadcrumb" aria-label={label}><ol className="flex min-w-0 flex-wrap items-center gap-2 text-body-sm text-fg-3">{visible.map((item, i) => <li key={item.id} className="flex min-w-0 items-center gap-2">
    {i > 0 && <Icon icon={ChevronRightIcon} className="size-3" />}
    {item.id === "ellipsis" ? <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="Show parent pages"><Icon icon={MoreIcon} /></Button></DropdownMenuTrigger><DropdownMenuContent>{hidden.map(parent => <DropdownMenuItem key={parent.id} asChild>{link(parent)}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      : i === visible.length - 1 ? <span aria-current="page" className="text-fg">{item.label}</span> : link(item)}
  </li>)}</ol></nav>;
}
/** Grey active fill for route tabs. Child anchors retain native link and router behavior. */
export function RouteTabs({ className, ...props }: ComponentProps<"nav">) {
  return <nav data-slot="route-tabs" {...props} className={cn("flex flex-wrap gap-1 [&_a]:inline-flex [&_a]:min-h-7 [&_a]:items-center [&_a]:rounded-md [&_a]:px-2.5 [&_a]:text-body-sm [&_a]:text-fg-2 [&_a:hover]:bg-tray [&_a[aria-current=page]]:bg-tray [&_a[aria-current=page]]:text-fg", className)} />;
}
export function NavItem({ active, icon, children, className, ...props }: ComponentProps<"a"> & { active?: boolean; icon?: ReactNode }) {
  return <a data-slot="nav-item" {...props} aria-current={active ? "page" : undefined} className={cn("flex min-h-8 items-center gap-2.5 rounded-md px-2.5 text-body-sm text-fg-2 hover:bg-tray", active && "bg-tray text-fg", className)}>{icon}{children}</a>;
}
export function NavTree({ children, className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("nav-tree ml-4.5 grid gap-0.5 pl-3 [&>a]:relative", className)}>{children}</div>;
}
export function NavBranch() { return <span aria-hidden="true" className="nav-tree-branch" />; }
/** Small reusable group, useful for a controlled navigation or a local component preview. */
export function NavigationPreview({ items }: { items: readonly { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  return <NavTree>{items.map(item => <NavItem key={item.id} href={`#${item.id}`} active={active === item.id} onClick={e => { e.preventDefault(); setActive(item.id); }}><NavBranch />{item.label}</NavItem>)}</NavTree>;
}
