"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@starterkit/ui/ui/input";
import { useDebounced, useRoleNames } from "./use-users";

/**
 * One role, typed: for when there are more roles than a picker lists (`useRoleNames().more`). Suggestions come from
 * the server as you type (`q`, native datalist); a full role name, typed or picked, is committed, and clearing the
 * field commits "".
 */
export function RoleSearch({ id, label, value, onChange }: { id?: string; label: string; value: string; onChange: (role: string) => void }) {
  const auto = useId();
  const inputId = id ?? auto;
  const [text, setText] = useState(value);
  // The value changed elsewhere (URL, Clear filters): adopt it while rendering.
  const [synced, setSynced] = useState(value);
  if (synced !== value) { setSynced(value); setText(value); }
  const roles = useRoleNames(useDebounced(text.trim()));
  const typed = text.trim();
  const match = roles.names.includes(typed) ? typed : null;
  useEffect(() => {
    if (typed === "" && value !== "") onChange("");
    else if (match && match !== value) onChange(match);
  }, [typed, match, value, onChange]);
  return (
    <div className="w-48">
      <Input id={inputId} aria-label={label} list={`${inputId}-roles`} value={text} placeholder={`${label}: type a name`} autoComplete="off"
        onChange={(e) => setText(e.target.value)} />
      <datalist id={`${inputId}-roles`}>{roles.names.map((n) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}
