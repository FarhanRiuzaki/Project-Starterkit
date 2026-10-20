"use client"

import * as React from "react"
import { Icon } from "./icon"
import { CloseIcon } from "./icons"
import { cn } from "../lib/cn"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "./button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-scrim data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--dur-exit) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--dur-enter)",
        className
      )}
      {...props}
    />
  )
}

/**
 * Dialog (spec §5.14): 480 px (pass `max-w-160` for 640), radius 16, padding 24, title title-1, footer buttons right; scrim fade `--dur-enter` in / `--dur-exit` out, panel opacity + scale 0.98, `--dur-slow` in / `--dur-exit` out (OVERLAY_MOTION.scrim, .dialog).
 * Below 768 px (`max-md:`) the same panel is a bottom sheet: full width, at most 90 dvh, the content scrolls with the
 * action row (DialogFooter) stuck to its bottom, safe-area padding below; it rises from the bottom on the same tokens
 * (reduced motion: fade only). CSS only, so the server HTML is already the right shape; `max-md:` rules win over a
 * caller's unprefixed desktop classes.
 * `phone="top"` (the command palette, a text field that opens the on-screen keyboard): below 768 px the panel hangs from
 * the top edge instead, full width, safe-area padding above, sliding down from the top; the caller caps its height.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  phone = "sheet",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  phone?: "sheet" | "top"
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-120 -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-xl border border-line bg-raised text-fg shadow-overlay outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=closed]:duration-(--dur-exit) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98 data-[state=open]:duration-(--dur-slow)",
          className,
          "max-md:left-0 max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:border-x-0 max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100",
          phone === "top"
            ? "max-md:top-0 max-md:rounded-t-none max-md:border-t-0 max-md:pt-safe max-md:data-[state=open]:slide-in-from-top max-md:data-[state=closed]:slide-out-to-top"
            : "max-md:top-auto max-md:bottom-0 max-md:max-h-[90dvh] scroll-quiet max-md:overflow-y-auto max-md:overscroll-contain max-md:rounded-b-none max-md:border-b-0 max-md:pb-safe max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom"
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-5 right-5 inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-tray hover:text-fg [&_svg]:size-4"
          >
            <Icon icon={CloseIcon} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 px-6 pt-6 pr-14 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-row justify-end gap-2 border-t border-line px-6 py-4",
        className,
        "max-md:sticky max-md:bottom-0 max-md:bg-raised"
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-title-1 text-fg", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-body-sm text-fg-2", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
