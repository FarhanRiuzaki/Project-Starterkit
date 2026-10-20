"use client";

import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { DUR } from "../motion/tokens";

/** Smallest thumb, px: still visible on a very long list. */
const MIN_THUMB = 24;

/** Thumb geometry of a scroll box (px within its height), or null when it doesn't scroll. */
export function thumbOf(scrollTop: number, scrollHeight: number, clientHeight: number): { top: number; height: number } | null {
  if (scrollHeight <= clientHeight + 1) return null;
  const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight);
  const travel = clientHeight - height;
  return { top: Math.round((scrollTop / (scrollHeight - clientHeight)) * travel), height: Math.round(height) };
}

/**
 * A vertical scroll box whose scrollbar takes no room: the native one is hidden (`scroll-none`) and a 4 px rounded
 * thumb is drawn over the right edge, shown while the box is hovered, holds keyboard focus, or has just scrolled
 * (it fades after DUR.flash). The content keeps its full width on every system (classic or overlay scrollbars), so
 * what sits above and below it lines up. Wheel, trackpad, touch and keys scroll it natively; the thumb is a cue, not
 * a handle. For a box whose width doesn't need to match its surroundings, `scroll-quiet` (CSS only) is enough.
 */
export function ScrollArea({ className, thumbClassName = "right-0.5", children, ...props }: ComponentProps<"div"> & { thumbClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setThumb(thumbOf(el.scrollTop, el.scrollHeight, el.clientHeight));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    return () => { ro.disconnect(); if (timer.current) clearTimeout(timer.current); };
  }, [measure]);
  const onScroll = () => {
    measure();
    setMoving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoving(false), DUR.flash * 1000);
  };
  return (
    <div className="group/scroll relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} onScroll={onScroll} className={cn("scroll-none min-h-0 flex-1 overflow-y-auto", className)} {...props}>{children}</div>
      {thumb && (
        <span aria-hidden="true" style={{ top: thumb.top, height: thumb.height }}
          className={cn("pointer-events-none absolute w-1 rounded-full bg-line-strong opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/scroll:opacity-100 group-hover/scroll:opacity-100",
            thumbClassName, moving && "opacity-100")} />
      )}
    </div>
  );
}
