import type { ActivityAction } from "@starterkit/shared/audit";
import type { AuthLogDto } from "@starterkit/shared/contracts/audit";
import type { Tx } from "../../kernel/db";
import { snapshot } from "./rules";
import { activity, authLog } from "./schema";

/** One activity entry by the request's user (`ctx.user`, the actor), inside the change's transaction. */
export async function recordActivity(
  tx: Tx,
  ctx: { user: { id: string; name: string } },
  e: { action: ActivityAction; target: { type: string; id: string; label: string }; before?: unknown; after?: unknown },
): Promise<void> {
  await tx.insert(activity).values({
    id: Bun.randomUUIDv7(), actorId: ctx.user.id, actorName: ctx.user.name, action: e.action,
    targetType: e.target.type, targetId: e.target.id, targetLabel: e.target.label, before: snapshot(e.before), after: snapshot(e.after),
  });
}

/** One sign-in log entry. */
export async function recordAuth(tx: Tx, e: Omit<AuthLogDto, "id" | "at">): Promise<void> {
  await tx.insert(authLog).values({ id: Bun.randomUUIDv7(), ...e });
}
