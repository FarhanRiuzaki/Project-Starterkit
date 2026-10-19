"use client";

import { type ChangeEvent, type KeyboardEvent, useId, useState } from "react";
import { Input } from "@starterkit/ui/ui/input";
import { useDebounced } from "@/lib/client/use-debounced";
import { useRoleNames } from "./use-users";

/**
 * What the field commits, or null for no change. Only an explicit choice applies a role (Enter, or a pick from the
 * suggestions), matched case-insensitively and given as the role's own name; typing alone never does, so "Admin"
 * isn't applied on the way to "Administrators". Clearing the text or typing away from the applied role removes it ("").
 */
export function nextRole(text: string, value: string, names: readonly string[], explicit: boolean): string | null {
  const typed = text.trim();
  const match = explicit ? names.find((n) => n.toLowerCase() === typed.toLowerCase()) : undefined;
  if (match) return match === value ? null : match;
  return value !== "" && typed !== value ? "" : null;
}

/**
 * One role, typed: for when there are more roles than a picker lists (`useRoleNames().more`). Suggestions come from
 * the server as you type (`q`, native datalist); see nextRole for what gets applied.
 */
export function RoleSearch({ id, label, value, onChange }: { id?: string; label: string; value: string; onChange: (role: string) => void }) {
  const auto = useId();
  const inputId = id ?? auto;
  const [text, setText] = useState(value);
  // The value changed elsewhere (URL, Clear filters): adopt it while rendering.
  const [synced, setSynced] = useState(value);
  if (synced !== value) { setSynced(value); setText(value); }
  const roles = useRoleNames(useDebounced(text.trim()));
  const commit = (t: string, explicit: boolean) => {
    const next = nextRole(t, value, roles.names, explicit);
    if (next !== null) onChange(next);
  };
  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    // A pick from the datalist arrives as a replacement of the whole text (no key typed).
    const inputType = (e.nativeEvent as InputEvent).inputType;
    commit(e.target.value, inputType === undefined || inputType === "insertReplacementText");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); // inside a dialog form, Enter picks the role instead of submitting
    commit(text, true);
  };
  return (
    <div className="w-48">
      <Input id={inputId} aria-label={label} list={`${inputId}-roles`} value={text} placeholder={`${label}: type, then Enter`} autoComplete="off"
        onChange={onInput} onKeyDown={onKeyDown} />
      <datalist id={`${inputId}-roles`}>{roles.names.map((n) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}
