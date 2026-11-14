"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

/** Letters as people read them: a family emoji or a syllable with its marks stays one piece. */
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const graphemes = (s: string) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s));

/**
 * Text that arrives piece by piece when it scrolls into view (design-system.md §7.8 R10), after affectUI's Text
 * Reveal (MIT): each word or letter fades out of a soft blur while it rises, `--reveal-step` apart, over
 * `--reveal-dur` (`reveal-text` in base.css). Imported by path (`@starterkit/ui/motion/text-reveal`), not from the
 * motion barrel, so it stays out of every other route's first load. Screen readers get the whole sentence at once; the pieces are hidden
 * from them. The text is invisible until JavaScript sees it on screen, so it is for headings and empty states, never
 * for data. Font, size and colour come from `className`. `once` false replays each time it enters the view.
 */
export function TextReveal({ text, by = "word", as: Tag = "p", once = true, className }: {
  text: string; by?: "word" | "char"; as?: "p" | "h1" | "h2" | "h3" | "span"; once?: boolean; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // From the first visible pixel: a paragraph taller than the screen would never reach a higher threshold.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setShown(true); if (once) io.disconnect(); }
        else if (!once) setShown(false);
      }
    }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  let i = 0;
  const piece = (key: number, s: string) => <span key={key} data-piece="" style={{ "--i": i++ } as CSSProperties}>{s}</span>;
  // Whitespace stays plain text so lines wrap as usual; the letters of one word sit in one group.
  const parts = text.split(/(\s+)/).map((part, k) => {
    if (part === "" || /^\s+$/.test(part)) return part;
    return by === "word" ? piece(k, part) : <span key={k} data-word="">{graphemes(part).map((ch, c) => piece(c, ch))}</span>;
  });

  return (
    <Tag ref={ref as never} className={cn("reveal-text", className)} data-shown={shown ? "" : undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{parts}</span>
    </Tag>
  );
}
