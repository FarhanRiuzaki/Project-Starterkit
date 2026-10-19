"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";

/**
 * Text filter written to the URL after a 300 ms pause. The typed text is never cleared; `sanitize` decides the
 * value that is sent. URL changes from elsewhere (e.g. "Clear filters") sync the input.
 */
export function FilterInput({ id, label, value, onCommit, sanitize, placeholder, hint, maxLength, inputMode }: {
  id: string; label: string; value: string; onCommit: (v: string) => void; sanitize: (s: string) => string;
  placeholder?: string; hint?: string; maxLength?: number; inputMode?: "text" | "url";
}) {
  const [text, setText] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) { committed.current = value; setText(value); }
  }, [value]);
  useEffect(() => {
    const next = sanitize(text);
    if (next === committed.current) return;
    const t = setTimeout(() => { committed.current = next; onCommit(next); }, 300);
    return () => clearTimeout(t);
  }, [text, sanitize, onCommit]);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-label text-fg-2">{label}</label>
      <Input id={id} type="search" autoComplete="off" spellCheck={false} maxLength={maxLength} inputMode={inputMode}
        placeholder={placeholder} aria-describedby={hintId} className="w-full sm:w-70" value={text} onChange={(e) => setText(e.target.value)} />
      {hint && <p id={hintId} className="text-caption text-fg-3">{hint}</p>}
    </div>
  );
}
