"use client";

import { type FormEventHandler, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { deferredOverlay } from "../ui/deferred-overlay";
import { CountBadge } from "./badges";
import { cn } from "../lib/cn";
import { useDelayedFlag } from "../motion/use-delayed-flag";
import { Icon } from "../ui/icon";
import { FilterIcon, SidebarCollapseIcon } from "../ui/icons";

const panel = deferredOverlay("dialog", "filter-panel-trigger", () => import("./filter-panel-impl"));
const Content = panel.part("FilterPanelContent");

/** The collapsed rail stays in its SSR surface. Only the user-opened panel needs a viewport measurement. */
export function FilterPanel({ anchor, active, open, onOpenChange, description, clear, canClear, children, onSubmit }: {
  anchor: HTMLDivElement | null;
  active: number; open: boolean; onOpenChange: (open: boolean) => void; description: string;
  clear: () => void; canClear: boolean; children: ReactNode; onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const focusIdRef = useRef<string | null>(null);
  const scrollDismissedRef = useRef(false);
  const [phone, setPhone] = useState(false);
  const [top, setTop] = useState(16);
  const surface = () => anchor?.closest<HTMLElement>('[data-slot="filter-surface"]') ?? anchor;
  const prepare = () => {
    const element = surface();
    if (!element || window.innerWidth < 768) return;
    if (window.innerHeight - element.getBoundingClientRect().top - 16 < 160) window.scrollBy({ top: element.getBoundingClientRect().top - 16, behavior: "instant" });
    setTop(Math.max(16, element.getBoundingClientRect().top));
  };
  useLayoutEffect(() => {
    const element = surface();
    if (!open || !element || phone) return;
    const header = element.parentElement?.querySelector<HTMLElement>(':scope > [data-slot="page-header"]');
    const measure = (event?: unknown) => {
      const next = Math.max(16, element.getBoundingClientRect().top, header?.getBoundingClientRect().bottom ?? 0);
      setTop(next);
      if (next >= window.innerHeight - 16 && event instanceof Event && event.type === "scroll") {
        scrollDismissedRef.current = true;
        const inside = document.activeElement?.closest('[data-slot="floating-filters"]');
        onOpenChange(false);
        if (inside && header && header.getBoundingClientRect().top >= 0 && header.getBoundingClientRect().top < window.innerHeight) header.querySelector("h1")?.focus({ preventScroll: true });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element.parentElement ?? element);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    document.addEventListener("animationend", measure);
    return () => { observer.disconnect(); window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); document.removeEventListener("animationend", measure); };
  }, [anchor, open, phone, onOpenChange]); // eslint-disable-line react-hooks/exhaustive-deps -- the anchor identifies the owning surface
  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      focusIdRef.current = (document.activeElement as HTMLElement | null)?.closest('[data-slot="floating-filters"]') ? (document.activeElement as HTMLElement).id : null;
      setPhone(media.matches);
    };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [load, setLoad] = useState<"pending" | "failed" | null>(null);
  const busy = useDelayedFlag(load === "pending");
  const loading = () => {
    prepare();
    if (panel.loader.get()) return;
    setLoad("pending");
    void panel.loader.load().then(impl => setLoad(impl ? null : "failed"));
  };
  return <div data-slot="filter-rail-lane" className="contents md:pointer-events-none md:absolute md:inset-y-0 md:-right-4 md:z-30 md:block md:w-12">
    {/* Keep this visual wrapper outside the deferred Root so primitive loading cannot remount the rail. */}
    <div data-slot="filter-launcher" className={cn("filter-rail flex max-md:min-h-8 items-center justify-end gap-2 md:pointer-events-auto md:sticky md:top-4 md:h-fit md:w-12 md:flex-col md:justify-start md:rounded-xl md:border md:border-line md:bg-card md:shadow-overlay", open && "md:invisible")}>
      <panel.Root open={open} onOpenChange={onOpenChange} modal={phone}>
        <panel.Trigger asChild onClick={loading} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") loading(); }}>
          <Button ref={trigger} variant="ghost" aria-busy={busy || undefined}
            aria-label={active ? `Expand filters, ${active} active selections` : "Expand filters"}
            className="filter-rail-button md:border-0 md:h-auto md:w-full md:flex-col md:items-center md:gap-3 md:px-1 md:py-3">
            <Icon icon={SidebarCollapseIcon} className="filter-rail-toggle max-md:hidden" /><Icon icon={FilterIcon} />
            {active > 0 && <CountBadge>{active}</CountBadge>}<span className="filter-rail-label md:h-11 md:[writing-mode:vertical-rl]">Filters</span>
          </Button>
        </panel.Trigger>
        {load && <span role={load === "failed" ? "alert" : "status"} className="text-caption text-fg-2 md:sr-only">{load === "failed" ? "Couldn't load filters. Try again." : "Loading filters…"}</span>}
        {load === "failed" && <Button variant="link" size="sm" onClick={() => trigger.current?.click()}>Retry filters</Button>}
        <Content top={top} scrollDismissedRef={scrollDismissedRef} active={active} open={open} phone={phone} focusIdRef={focusIdRef} description={description} clear={clear} canClear={canClear} onSubmit={onSubmit}
          restoreFocus={() => trigger.current?.focus({ preventScroll: true })}>{children}</Content>
      </panel.Root>
    </div>
  </div>;
}
export const filterPanelLoader = panel.loader;
