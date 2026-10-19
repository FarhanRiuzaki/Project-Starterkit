"use client";

import { useEffect, useState } from "react";
import { Icon } from "../ui/icon";
import { SearchIcon } from "../ui/icons";
import { Input } from "../ui/input";
import { parseQuery, type Query, serializeQuery } from "../lib/query";
import { FilterChip } from "./badges";

/** Toolbar search (spec §5.6): grows, 32 px, leading icon; active filters as removable FilterChips. Pencarian dengan sintaks `kunci:nilai`; filter tampil sebagai chip yang bisa dihapus. Debounce 200 ms. */
/** `id`: pass it with a visible `<label htmlFor={id}>`; the visible label then names the input instead of `aria-label`. */
export function QueryInput({ id, value, onChange, keys, label, placeholder }: {
  id?: string; value: string; onChange: (v: string) => void; keys: readonly string[]; label: string; placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  // External value changed (URL, chip removed): adopt it while rendering, not in an effect (no extra render pass).
  const [synced, setSynced] = useState(value);
  if (synced !== value) { setSynced(value); setDraft(value); }
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft.slice(0, 200)), 200);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  const q = parseQuery(value, keys);

  function remove(key: string, v: string) {
    const next: Query = { text: q.text, filters: { ...q.filters, [key]: (q.filters[key] ?? []).filter((x) => x !== v) } };
    onChange(serializeQuery(next));
  }

  return (
    <div className="grid min-w-0 gap-2">
      <div className="relative">
        <Icon icon={SearchIcon} className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3" />
        <Input id={id} aria-label={id ? undefined : label} value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="pl-8.5 font-mono text-body-sm" />
      </div>
      {Object.keys(q.filters).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(q.filters).flatMap(([k, vs]) => vs.map((v) => (
            <FilterChip key={`${k}:${v}`} removeLabel={`Remove filter ${k}:${v}`} onRemove={() => remove(k, v)}>{k}:{v}</FilterChip>
          )))}
        </div>
      )}
    </div>
  );
}
