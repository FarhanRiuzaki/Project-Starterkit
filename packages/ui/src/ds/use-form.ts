"use client";

import { type ChangeEvent, type FormEvent, useCallback, useMemo, useState } from "react";
import { type Errors, firstError, type Schema, validateAll, type Values } from "../lib/validate";

/** Moves focus to field `id` after React has rendered its error (and scrolls it into view with its label). */
const focusField = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

/**
 * Form state with validation on the user's terms (NN/g, GOV.UK): a field's error shows once the user has left it
 * (blur) or tried to submit, and updates as they type from then on, so a fixed value clears at once ("reward early,
 * punish late"). A failed submit focuses the first field with an error (schema order); `ErrorSummary` lists them all.
 * `check(keys)` validates part of the form (a wizard step) and focuses its first error. Ids are `${idPrefix}-${field}`.
 */
export function useForm<V extends Values>({ initial, schema, idPrefix }: { initial: V; schema: Schema<V>; idPrefix: string }) {
  const [values, setValues] = useState<V>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => validateAll(values, schema), [values, schema]);
  const id = useCallback((k: keyof V & string) => `${idPrefix}-${k}`, [idPrefix]);
  const set = useCallback(<K extends keyof V>(k: K, v: V[K]) => setValues((cur) => ({ ...cur, [k]: v })), []);
  const blur = useCallback((k: keyof V) => setTouched((t) => (t[k] ? t : { ...t, [k]: true })), []);
  /** The message the user should see now for `k`, or undefined. */
  const error = (k: keyof V & string) => (submitted || touched[k] ? errors[k] : undefined);
  /** Errors on screen now (for ErrorSummary). */
  const shown: Errors<V> = Object.fromEntries(Object.entries(errors).filter(([k]) => submitted || touched[k])) as Errors<V>;

  /** Validates `keys` (all touched now); true when they pass, else focuses the first failing one. */
  function check(keys: readonly (keyof V & string)[]): boolean {
    setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    const part = Object.fromEntries(keys.map((k) => [k, schema[k]])) as Schema<V>;
    const first = firstError(validateAll(values, part), part);
    if (first) focusField(id(first));
    return !first;
  }

  /** onSubmit handler: validates everything; calls `onValid(values)` only when it all passes. */
  const submit = (onValid: (values: V) => void | Promise<void>) => (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    const first = firstError(validateAll(values, schema), schema);
    if (first) { focusField(id(first)); return; }
    return onValid(values);
  };

  /** Props for a text control (Input, Textarea): id, value, change and blur. */
  const text = (k: keyof V & string) => ({
    id: id(k), name: k, value: String(values[k] ?? ""),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as V[typeof k]),
    onBlur: () => blur(k),
  });

  const reset = (next: V = initial) => { setValues(next); setTouched({}); setSubmitted(false); };
  return { values, set, blur, error, errors, shown, id, text, check, submit, reset, submitted, valid: Object.keys(errors).length === 0 };
}
