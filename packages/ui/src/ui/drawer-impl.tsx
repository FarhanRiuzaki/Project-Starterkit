"use client"

// The Radix dialog behind the navigation drawer, loaded as its own chunk through ./drawer (deferredOverlay); import that module, not this one.

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "../lib/cn"

function Root(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

function Trigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

/**
 * Everything in <body> but the drawer's own portal is `inert` while the drawer is mounted (Radix already traps focus
 * and hides the rest from assistive tech; inert also stops find-in-page and stray taps). Removed on unmount, before
 * Radix hands focus back to the trigger. Elements that were inert already are left alone.
 */
function useInertOutside(el: HTMLElement | null) {
  React.useEffect(() => {
    if (!el) return
    const others = [...el.ownerDocument.body.children].filter((c) => !c.contains(el) && !c.hasAttribute("inert"))
    for (const o of others) o.setAttribute("inert", "")
    return () => { for (const o of others) o.removeAttribute("inert") }
  }, [el])
}

/**
 * Navigation drawer (phone): from the left edge, 288 px and at most 5/6 of the width, on the sidebar's surface with
 * the overlay shadow; safe-area padding top, bottom and left. Scrim fade `--dur-enter` in / `--dur-exit` out, panel
 * slide + fade `--dur-slow` in / `--dur-exit` out (OVERLAY_MOTION.scrim, .drawer); reduced motion keeps the fade only.
 * `title` names the dialog for assistive tech.
 */
function DrawerContent({ title, className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  // State, not a ref: the portal mounts its content a render later, after a ref effect would have run.
  const [el, setEl] = React.useState<HTMLDivElement | null>(null)
  useInertOutside(el)
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 bg-scrim data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--dur-exit) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--dur-enter)"
      />
      <DialogPrimitive.Content
        ref={setEl}
        data-slot="drawer-content"
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-5/6 flex-col bg-bg pt-safe pb-safe pl-safe text-fg shadow-overlay outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-left data-[state=closed]:duration-(--dur-exit) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-left data-[state=open]:duration-(--dur-slow)",
          className
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export { DrawerClose, DrawerContent, Root, Trigger }
