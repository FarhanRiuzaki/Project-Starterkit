"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Skeleton } from "../ui/skeleton";

/**
 * Render anak saat mendekati viewport (rootMargin 200px); sebelumnya skeleton setinggi `minHeight`
 * agar tidak ada pergeseran tata letak. Sekali tampil, tetap tampil (IntersectionObserver: every supported browser).
 */
export function LazyMount({ minHeight, children }: { minHeight: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setMounted(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  if (mounted) return <>{children}</>;
  return (
    <div ref={ref} aria-busy="true" style={{ minHeight }}>
      <Skeleton className="w-full rounded-md" style={{ height: minHeight }} />
    </div>
  );
}
