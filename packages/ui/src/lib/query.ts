export type Query = { text: string; filters: Record<string, string[]> };

const MAX = 200;
const TOKEN = /(\S+?):(?:"([^"]*)"|(\S*))|"[^"]*"|\S+/g;

/** Sintaks `kunci:nilai` / `kunci:"nilai berspasi"`; kunci tak dikenal tetap teks bebas. */
export function parseQuery(input: string, keys: readonly string[]): Query {
  const allowed = new Set(keys.map((k) => k.toLowerCase()));
  const filters: Record<string, string[]> = {};
  const text: string[] = [];
  for (const m of input.slice(0, MAX).matchAll(TOKEN)) {
    const key = m[1]?.toLowerCase();
    const quoted = m[2];
    const raw = quoted ?? m[3];
    if (key && allowed.has(key)) {
      // A known key with an empty value (`status:`, `status:""`) is a half-typed filter: no filter, no free text.
      if (raw?.trim()) (filters[key] ??= []).push(quoted != null ? raw : raw.toLowerCase());
    } else text.push(m[0]);
  }
  return { text: text.join(" "), filters };
}

export function serializeQuery(q: Query): string {
  const parts = Object.entries(q.filters).flatMap(([k, vs]) => vs.map((v) => (/\s/.test(v) ? `${k}:"${v}"` : `${k}:${v}`)));
  return [...parts, q.text].filter(Boolean).join(" ");
}

/**
 * Search box (QueryInput): what to send for the typed `draft` while the applied value is `value`: the trimmed draft
 * (at most 200 characters), or null when it is already applied. Spaces are kept in the draft and only trimmed here.
 */
export function searchToSend(draft: string, value: string): string | null {
  const next = draft.trim().slice(0, 200);
  return next === value.trim() ? null : next;
}

/** Search box: the draft after the applied value changed to `value` elsewhere; the draft stays when `value` is just its trimmed form. */
export const adoptSearch = (draft: string, value: string): string => (value.trim() === draft.trim() ? draft : value);
