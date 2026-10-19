"use client";

import { Command as CommandPrimitive } from "cmdk";
import * as React from "react";
import { Icon } from "./icon";
import { SearchIcon } from "./icons";
import { cn } from "../lib/cn";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("flex h-full w-full flex-col overflow-hidden bg-raised text-fg", className)} {...props} />;
}
function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-line px-4">
      <Icon icon={SearchIcon} className="size-4 shrink-0 text-fg-3" />
      <CommandPrimitive.Input data-slot="command-input" className={cn("h-full w-full bg-transparent text-body text-fg outline-none placeholder:text-fg-3", className)} {...props} />
    </div>
  );
}
function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("max-h-90 overflow-y-auto overscroll-contain p-2", className)} {...props} />;
}
function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-8 text-center text-body-sm text-fg-2" {...props} />;
}
function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group data-slot="command-group" className={cn("[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-fg-3", className)} {...props} />;
}
function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item data-slot="command-item" className={cn("flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-body-sm text-fg data-[disabled=true]:opacity-50 data-[selected=true]:bg-tray [&_svg]:size-4 [&_svg]:text-fg-3", className)} {...props} />;
}

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList };
