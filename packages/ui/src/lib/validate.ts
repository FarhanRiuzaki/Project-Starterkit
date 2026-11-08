/**
 * Form validation without a schema library in the client bundle (zod stays server-side, AGENTS.md §9): small rules
 * that answer a message or null, run per field in order. Messages follow the copy guide: what to do, in the user's
 * words ("Enter an email address like name@example.com."). Only `required` judges an empty value; the others pass it,
 * so an optional field is checked only when filled in.
 */
export type Values = Record<string, unknown>;
export type Rule = (value: unknown, values: Values) => string | null;
export type Schema<V extends Values> = { [K in keyof V]?: readonly Rule[] };
export type Errors<V extends Values> = Partial<Record<keyof V & string, string>>;

const empty = (v: unknown) => v == null || v === false || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
const text = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : text(v).trim() === "" ? null : Number(text(v)));
/** A rule that skips an empty value. */
const filled = (check: (v: unknown, values: Values) => string | null): Rule => (v, values) => (empty(v) ? null : check(v, values));

export const rules = {
  required: (message = "Enter a value."): Rule => (v) => (empty(v) ? message : null),
  minLength: (n: number, message = `Use at least ${n} characters.`): Rule => filled((v) => (text(v).length < n ? message : null)),
  maxLength: (n: number, message = `Use ${n} characters or fewer.`): Rule => filled((v) => (text(v).length > n ? message : null)),
  pattern: (re: RegExp, message: string): Rule => filled((v) => (re.test(text(v)) ? null : message)),
  email: (message = "Enter an email address like name@example.com."): Rule =>
    filled((v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v).trim()) ? null : message)),
  min: (n: number, message = `Enter ${n} or more.`): Rule => filled((v) => { const x = num(v); return x === null || Number.isNaN(x) || x < n ? message : null; }),
  max: (n: number, message = `Enter ${n} or less.`): Rule => filled((v) => { const x = num(v); return x === null || Number.isNaN(x) || x > n ? message : null; }),
  matches: (field: string, message = "The two values don't match."): Rule => (v, values) => (text(v) === text(values[field]) ? null : message),
} as const;

/** The first message of each field's rules, for every field the schema names. */
export function validateAll<V extends Values>(values: V, schema: Schema<V>): Errors<V> {
  const out: Errors<V> = {};
  for (const [k, list] of Object.entries(schema) as [keyof V & string, readonly Rule[] | undefined][]) {
    for (const r of list ?? []) {
      const m = r(values[k], values);
      if (m) { out[k] = m; break; }
    }
  }
  return out;
}

/** The first field with an error in the schema's order (where focus goes after a failed submit), or null. */
export function firstError<V extends Values>(errors: Errors<V>, schema: Schema<V>): (keyof V & string) | null {
  return (Object.keys(schema) as (keyof V & string)[]).find((k) => errors[k]) ?? null;
}
