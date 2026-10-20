import type { SQL } from "bun";
import { type ActivityAction, MASK, SECRET_KEY } from "@starterkit/shared/audit";
import type { AuthLogDto } from "@starterkit/shared/contracts/audit";
import type { Ctx } from "../http/guard";

/** UserRow fields that must never reach an entry, even when a caller passes the raw row. */
const HIDDEN = new Set(["passwordHash", "totpSecret", "pendingTotpSecret", "recoveryCodes"]);

/**
 * Plain-data copy of `before`/`after` as JSON text: the row's own credential fields are dropped, and any other
 * credential-named field (SECRET_KEY, at any depth) keeps only `MASK` when it had a value. So the API, the CSV, the
 * dashboard and the diff never see a credential, whatever a caller passes.
 */
const snapshot = (v: unknown): string =>
  v === undefined ? "null" : JSON.stringify(v, (k, x: unknown) => (HIDDEN.has(k) ? undefined : k && SECRET_KEY.test(k) && x != null ? MASK : x));

/** One activity entry by the request's user, inside the change's transaction. */
export async function recordActivity(
  tx: SQL,
  ctx: Ctx,
  e: { action: ActivityAction; target: { type: string; id: string; label: string }; before?: unknown; after?: unknown },
): Promise<void> {
  // jsonb through text: a parameter typed jsonb would be JSON-encoded a second time
  await tx`insert into activity (id, actor_id, actor_name, action, target_type, target_id, target_label, before, after)
    values (${Bun.randomUUIDv7()}, ${ctx.user.id}, ${ctx.user.name}, ${e.action}, ${e.target.type}, ${e.target.id}, ${e.target.label},
            ${snapshot(e.before)}::text::jsonb, ${snapshot(e.after)}::text::jsonb)`;
}

/** One sign-in log entry. */
export async function recordAuth(db: SQL, e: Omit<AuthLogDto, "id" | "at">): Promise<void> {
  await db`insert into auth_log (id, event, login, user_id, method, ip, device, location)
    values (${Bun.randomUUIDv7()}, ${e.event}, ${e.login}, ${e.userId}, ${e.method}, ${e.ip}, ${e.device}, ${e.location})`;
}
