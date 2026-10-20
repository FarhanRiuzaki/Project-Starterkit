"use client";

import { type FocusEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Icon } from "../ui/icon";
import { CheckIcon, ChevronDownIcon, CloseIcon, SpinnerIcon } from "../ui/icons";

export type ComboOption = { value: string; label: string; description?: string; disabled?: boolean };
type Load = (query: string, signal: AbortSignal) => Promise<ComboOption[]>;
type Common = {
  id?: string; label: string; placeholder?: string; disabled?: boolean; invalid?: boolean; describedBy?: string; className?: string;
  /** Set by a wrapping Field (its note, error and required): passed to the input with `describedBy` / `invalid`. */
  "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false"; "aria-required"?: boolean | "true" | "false";
  /** Local options, filtered by label as the user types; or `loadOptions` for a server search. */
  options?: readonly ComboOption[];
  /** Server search (debounced 250 ms, the previous request aborted): `(query, signal) => options`. */
  loadOptions?: Load;
  /** Offer "Create “text”" when no option has that label exactly. */
  onCreate?: (text: string) => ComboOption;
  /** When nothing matches: says what to try. */
  emptyText?: string;
  onBlur?: () => void;
};
type Single = Common & { multiple?: false; value: ComboOption | null; onChange: (v: ComboOption | null) => void };
type Multiple = Common & { multiple: true; value: readonly ComboOption[]; onChange: (v: ComboOption[]) => void };

const DEBOUNCE_MS = 250;
const CREATE = "\u0000create";

/** Options matching `query` (label, case-insensitive), the matches that start with it first; all of them for no query. */
export function filterOptions(options: readonly ComboOption[], query: string): ComboOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  const hits = options.filter((o) => o.label.toLowerCase().includes(q));
  return [...hits.filter((o) => o.label.toLowerCase().startsWith(q)), ...hits.filter((o) => !o.label.toLowerCase().startsWith(q))];
}

/** The next enabled index from `from` going `step` (wraps), or -1 when none is enabled. */
export function nextEnabled(list: readonly { disabled?: boolean }[], from: number, step: 1 | -1): number {
  for (let i = 1; i <= list.length; i++) {
    const j = (from + step * i + list.length * 2) % list.length;
    if (!list[j]!.disabled) return j;
  }
  return -1;
}

/**
 * Combobox (the "select2" of the starterkit; WAI-ARIA APG combobox with a listbox popup): a text field that filters a
 * list as the user types, for choosing one (`value` + clear button) or several (`multiple`: chips before the text, each
 * removable by its × or by Backspace on an empty field). Keys: ↓ opens and moves, ↑ moves, Enter picks the active
 * option, Esc closes (a second Esc clears the text), Tab leaves. Local `options` filter on the client; `loadOptions`
 * searches the server (loading, error with retry, and empty states in the list), and the result count is announced.
 * `onCreate` adds a "Create “text”" option. Use a RadioGroup for 2–6 options that fit on the page, a native Select
 * for a short fixed list without search.
 */
export function Combobox(props: Single | Multiple) {
  const invalid = props.invalid || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  const describedBy = [props.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  const { label, placeholder, disabled, className, options, loadOptions, onCreate, emptyText = "No matches. Try another word." } = props;
  const auto = useId();
  const id = props.id ?? auto;
  const listId = `${id}-list`;
  const multiple = props.multiple === true;
  const raw = props.value;
  const chosen: readonly ComboOption[] = useMemo(() => (multiple ? (raw as readonly ComboOption[]) : raw ? [raw as ComboOption] : []), [multiple, raw]);
  const single = !multiple ? (props as Single).value : null;

  const [text, setText] = useState(single?.label ?? "");
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<{ q: string; items: ComboOption[] } | null>(null);
  /** The query whose search failed (its list shows the error), or null. */
  const [failed, setFailed] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = typing ? text : "";

  // A single value chosen elsewhere: show its label while the user isn't typing.
  const [synced, setSynced] = useState(single?.value);
  if (!multiple && synced !== single?.value) { setSynced(single?.value); setText(single?.label ?? ""); setTyping(false); }

  useEffect(() => {
    if (!loadOptions || !open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      loadOptions(query.trim(), ctrl.signal)
        .then((items) => { setRemote({ q: query, items }); setFailed(null); })
        .catch(() => { if (!ctrl.signal.aborted) setFailed(query); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [loadOptions, open, query, retry]);
  // Derived, not stored: loading while the shown list belongs to another query; an error for the query that failed.
  const state: "idle" | "loading" | "error" = !loadOptions ? "idle" : failed === query ? "error" : open && remote?.q !== query ? "loading" : "idle";

  const items = useMemo(() => {
    const base = loadOptions ? (remote?.items ?? []) : filterOptions(options ?? [], query);
    const list = multiple ? base.filter((o) => !chosen.some((c) => c.value === o.value)) : base;
    const typed = query.trim();
    const canCreate = onCreate && typed && !list.some((o) => o.label.toLowerCase() === typed.toLowerCase()) && !chosen.some((c) => c.label.toLowerCase() === typed.toLowerCase());
    return canCreate ? [...list, { value: CREATE, label: `Create “${typed}”` }] : list;
  }, [loadOptions, remote, options, query, multiple, chosen, onCreate]);

  const show = (next: boolean) => { setOpen(next); setActive(next ? items.findIndex((o) => !o.disabled) : -1); };
  const pick = (o: ComboOption) => {
    if (o.disabled) return;
    const real = o.value === CREATE ? onCreate!(query.trim()) : o;
    if (multiple) {
      (props as Multiple).onChange([...chosen, real]);
      setText(""); setTyping(false); setActive(0);
      inputRef.current?.focus();
    } else {
      (props as Single).onChange(real);
      setText(real.label); setTyping(false); setOpen(false);
    }
  };
  const remove = (v: string) => (props as Multiple).onChange(chosen.filter((c) => c.value !== v));
  const clear = () => { (props as Single).onChange(null); setText(""); setTyping(false); inputRef.current?.focus(); };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { show(true); return; }
      setActive((a) => nextEnabled(items, a < 0 ? (e.key === "ArrowDown" ? -1 : 0) : a, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && items[active]) { e.preventDefault(); pick(items[active]!); }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); setOpen(false); } else if (text) { e.preventDefault(); setText(multiple ? "" : (single?.label ?? "")); setTyping(false); }
    } else if (e.key === "Backspace" && multiple && text === "" && chosen.length) {
      remove(chosen.at(-1)!.value);
    }
  };
  const onBlurAll = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setOpen(false);
    if (!multiple) { setText(single?.label ?? ""); setTyping(false); }
    else { setText(""); setTyping(false); }
    props.onBlur?.();
  };

  const status = state === "loading" ? "Searching…" : state === "error" ? "" : open ? `${items.length} ${items.length === 1 ? "option" : "options"}` : "";
  let body: ReactNode;
  if (state === "error") {
    body = (
      <li role="presentation" className="flex items-center justify-between gap-2 px-2.5 py-2 text-body-sm text-down-ink">
        Couldn&apos;t load the options.
        <button type="button" className="cursor-pointer rounded-xs underline underline-offset-4" onClick={() => { setFailed(null); setRetry((r) => r + 1); }}>Try again</button>
      </li>
    );
  } else if (state === "loading" && !remote) {
    body = <li role="presentation" className="flex items-center gap-2 px-2.5 py-2 text-body-sm text-fg-3"><Icon icon={SpinnerIcon} className="size-4 motion-safe:animate-spin" />Searching…</li>;
  } else if (items.length === 0) {
    body = <li role="presentation" className="px-2.5 py-2 text-body-sm text-fg-3">{emptyText}</li>;
  } else {
    body = items.map((o, i) => {
      const on = !multiple && single?.value === o.value;
      return (
        <li key={o.value} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} aria-disabled={o.disabled || undefined}
          onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseMove={() => !o.disabled && setActive(i)}
          className={cn("flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-body text-fg", i === active && "bg-tray",
            o.disabled && "cursor-not-allowed opacity-50", o.value === CREATE && "text-primary-ink")}>
          <span className="grid min-w-0 flex-1">
            <span className="truncate">{o.label}</span>
            {o.description && <span className="truncate text-body-sm text-fg-3">{o.description}</span>}
          </span>
          {on && <Icon icon={CheckIcon} className="mt-0.5 size-4 shrink-0 text-primary" />}
        </li>
      );
    });
  }

  return (
    <div className={cn("relative", className)} onBlur={onBlurAll}>
      <div onClick={() => inputRef.current?.focus()}
        className={cn("flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-line-strong bg-card px-1.5 py-1 transition-[border-color,box-shadow] duration-(--dur-fast)",
          "focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft",
          invalid && "border-down-mark focus-within:ring-down-soft", disabled && "pointer-events-none bg-inset opacity-60")}>
        {multiple && chosen.map((c) => (
          <span key={c.value} className="inline-flex h-6 max-w-full items-center gap-1 rounded-sm bg-tray pr-0.5 pl-2 text-body-sm text-fg">
            <span className="truncate">{c.label}</span>
            <button type="button" aria-label={`Remove ${c.label}`} onClick={() => remove(c.value)}
              className="relative inline-grid size-5 shrink-0 cursor-pointer place-items-center rounded-xs text-fg-3 outline-none after:absolute after:-inset-1 hover:bg-line hover:text-fg focus-visible:outline-2 focus-visible:outline-primary">
              <Icon icon={CloseIcon} className="size-3.5" />
            </button>
          </span>
        ))}
        <input ref={inputRef} id={id} role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-required={props["aria-required"]}
          disabled={disabled} autoComplete="off" placeholder={multiple && chosen.length ? undefined : placeholder} value={text}
          onChange={(e) => { setText(e.target.value); setTyping(true); if (!open) show(true); else setActive(0); }}
          onFocus={() => { if (!open) show(true); }} onKeyDown={onKeyDown}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-body text-fg outline-none placeholder:text-fg-3" />
        {!multiple && single && !disabled
          ? <button type="button" aria-label={`Clear ${label}`} onClick={clear}
              className="inline-grid size-6 shrink-0 cursor-pointer place-items-center rounded-xs text-fg-3 hover:text-fg"><Icon icon={CloseIcon} className="size-3.5" /></button>
          : <Icon icon={ChevronDownIcon} className="mr-1 size-4 shrink-0 text-fg-3" />}
      </div>
      <ul id={listId} role="listbox" aria-label={label} aria-multiselectable={multiple || undefined} hidden={!open}
        className="scroll-quiet absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-raised p-1 shadow-overlay">
        {body}
      </ul>
      <span role="status" aria-live="polite" className="sr-only">{status}</span>
    </div>
  );
}
