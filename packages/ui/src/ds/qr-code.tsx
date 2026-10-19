"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { cn } from "../lib/cn";

/** Versions 1–10 at ECC M (an otpauth URI is about 80 bytes, version 5): 21 + 4 × (version − 1) modules. */
const MAX_MODULES = 57;
/** The quiet zone the QR spec asks for, in modules. */
const QUIET = 4;

/** The module matrix (true = dark) of `value`, byte mode, error correction M, the smallest version that fits. */
export function qrMatrix(value: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(value, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  if (n > MAX_MODULES) throw new Error("QR data too long");
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/**
 * A QR code drawn as inline SVG in the browser (no remote QR service, no image URL: the CSP stays img-src 'self' data:).
 * Used for the otpauth URI of the MFA setup (MFA setup): the value never goes into the markup, only the drawing, and the
 * caller keeps it in component state only. Always dark modules on a white tile, in both themes, so every
 * authenticator camera reads it.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, d } = useMemo(() => {
    const m = qrMatrix(value);
    let path = "";
    m.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + QUIET} ${y + QUIET}h1v1h-1z`; }));
    return { size: m.length + 2 * QUIET, d: path };
  }, [value]);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges"
      className={cn("block rounded-md bg-white text-black", className)}>
      <path fill="currentColor" d={d} />
    </svg>
  );
}
