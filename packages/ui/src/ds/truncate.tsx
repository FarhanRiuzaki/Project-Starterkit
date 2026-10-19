"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { frameScheduler } from "../ui/frame";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { isClipped } from "../lib/overflow";

/** Elipsis satu baris; tooltip dan tab stop hanya aktif saat teks benar-benar terpotong. Elemen yang diamati tetap sama sepanjang umur komponen. */
export function Truncate({ children, title }: { children: ReactNode; title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  // Always controlled: switching `open` between undefined and a value makes Radix warn.
  const [open, setOpen] = useState(false);

  // Measured in the next frame, not in the commit (a table has dozens: each read there forced a synchronous layout).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(isClipped(el));
    const frame = frameScheduler(measure);
    frame.schedule();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => { frame.cancel(); ro?.disconnect(); };
  }, [children, title]);

  return (
    <Tooltip open={clipped && open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span ref={ref} className="block min-w-0 truncate" tabIndex={clipped ? 0 : undefined}>{children}</span>
      </TooltipTrigger>
      {clipped && <TooltipContent className="break-all">{title}</TooltipContent>}
    </Tooltip>
  );
}
