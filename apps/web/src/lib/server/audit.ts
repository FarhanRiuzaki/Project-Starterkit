import "server-only";
import { randomUUID } from "node:crypto";
import { MASK, SECRET_KEY } from "@/lib/shared/audit";
import type { AuthLogDto } from "@/lib/shared/contracts/audit";
import type { AuthCtx } from "./session";
import { db } from "./mock/db";

const MAX_ENTRIES = 10_000;
/** UserRecord fields that must never reach a log entry, even when a caller passes the raw record. */
const HIDDEN = new Set(["passwordHash", "totpSecret", "pendingTotpSecret", "recoveryCodes"]);

/** Insert, evicting the oldest entries once the Map is full (never clearing it). */
function put<T>(m: Map<string, T>, id: string, v: T): void {
  while (m.size >= MAX_ENTRIES) {
    const oldest = m.keys().next().value;
    if (oldest === undefined) break;
    m.delete(oldest);
  }
  m.set(id, v);
}

/**
 * Plain-data copy of `before`/`after` (later edits to the source don't change history): the record's own credential
 * fields are dropped, and any other credential-named field (SECRET_KEY, at any depth) keeps only `MASK` when it had a
 * value. So the API, the CSV, the dashboard and the diff never see a credential, whatever a caller passes.
 */
const snapshot = (v: unknown): unknown =>
  v === undefined ? null : JSON.parse(JSON.stringify(v, (k, x: unknown) => (HIDDEN.has(k) ? undefined : k && SECRET_KEY.test(k) && x != null ? MASK : x)));

export function recordActivity(
  ctx: AuthCtx,
  entry: { action: string; target: { type: string; id: string; label: string }; before?: unknown; after?: unknown },
): void {
  const id = `act-${randomUUID()}`;
  put(db().activity, id, {
    id, at: new Date().toISOString(), actor: { id: ctx.user.id, name: ctx.user.name },
    action: entry.action, target: entry.target, before: snapshot(entry.before), after: snapshot(entry.after),
  });
}

export function recordAuth(entry: Omit<AuthLogDto, "id" | "at">): void {
  const id = `log-${randomUUID()}`;
  put(db().authLog, id, { ...entry, id, at: new Date().toISOString() });
}
