import { clsx, twMerge } from "cn";

type ClassValue = Parameters<typeof clsx>[number];

/**
 * `cn` (clsx + tailwind-merge) that knows the console type scale (globals.css `--text-*`). Plain tailwind-merge reads
 * `text-label`, `text-body-sm`, … as text colours, so `cn("text-label text-fg-3")` silently drops the size. Each
 * type-scale class is masked as an arbitrary font-size (`text-[length:…]`) for the merge and restored after, which
 * keeps size and colour in separate groups. Costs a few hundred bytes, unlike a full extended merge config.
 */
const SIZES = ["display", "title-1", "title-2", "title-3", "stat", "stat-sm", "body", "body-sm", "label", "caption", "mono", "wordmark-sm", "wordmark-md", "wordmark-lg", "wordmark-desc"];
const SIZE = new RegExp(`^(.*:)?(!?)text-(${SIZES.join("|")})(!?)$`);

/**
 * Memo by joined class string: render paths call cn with the same few hundred strings on every render, and the
 * mask + merge is the costly part. Bounded: past MEMO_MAX distinct strings the memo starts over.
 */
const MEMO_MAX = 1_000;
const memo = new Map<string, string>();

export function cn(...inputs: ClassValue[]): string {
  const joined = clsx(...inputs);
  const hit = memo.get(joined);
  if (hit !== undefined) return hit;
  if (memo.size >= MEMO_MAX) memo.clear();
  const out = merge(joined);
  memo.set(joined, out);
  return out;
}

function merge(joined: string): string {
  const restore = new Map<string, string>();
  const masked = joined.split(/\s+/).filter(Boolean).map((c) => {
    const m = SIZE.exec(c);
    if (!m) return c;
    const key = `${m[1] ?? ""}${m[2]}text-[length:--sk-${m[3]}]${m[4]}`;
    restore.set(key, c);
    return key;
  });
  return twMerge(masked.join(" ")).split(" ").map((c) => restore.get(c) ?? c).join(" ");
}
