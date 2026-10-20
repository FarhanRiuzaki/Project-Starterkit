// Saved list views (/v1/me/views): the signed-in user's own named views of a list page (search, filters, sort, rows per
// page as the URL query). A viewer preference, like the prefs cookie: no activity entry (conformance NO_ACTIVITY).
import type { Page } from "@starterkit/shared/contracts/common";
import { type CreateSavedViewBody, MAX_SAVED_VIEWS, type SavedViewDto, type SavedViewListQuery } from "@starterkit/shared/contracts/me";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../kernel/db";
import { ApiError } from "../../kernel/errors";
import { one, pageQuery, sortSql } from "../../kernel/pagination";
import { isUuid } from "../../kernel/parse";
import type { Ctx } from "../auth";
import { lockUser } from "../users";
import { savedViews } from "./schema";

const SORTS = { name: sql`lower(${savedViews.name})`, createdAt: savedViews.createdAt };
const toDto = (v: typeof savedViews.$inferSelect): SavedViewDto => ({ id: v.id, path: v.path, name: v.name, query: v.query, createdAt: v.createdAt.toISOString() });

/** One page of the caller's saved views on list page `q.path`, by name unless `sort` says otherwise. */
export async function viewPage(userId: string, q: SavedViewListQuery): Promise<Page<SavedViewDto>> {
  const where = and(eq(savedViews.userId, userId), eq(savedViews.path, q.path));
  return pageQuery({
    rows: db.select().from(savedViews).where(where).$dynamic(),
    count: db.select(one).from(savedViews).where(where).$dynamic(),
    orderBy: sortSql(q.sort, SORTS, "name", savedViews.id),
    query: q,
    map: toDto,
  });
}

/**
 * Saves a view: 409 `duplicate` when the caller already has one by that name on that page (any letter case), 400 at
 * MAX_SAVED_VIEWS. The caller's row is locked first, so two saves at the limit can't both pass the count.
 */
export async function saveView(ctx: Ctx, b: CreateSavedViewBody): Promise<SavedViewDto> {
  return db.transaction(async (tx) => {
    await lockUser(tx, ctx.user.id);
    const mine = and(eq(savedViews.userId, ctx.user.id), eq(savedViews.path, b.path));
    const taken = await tx.select({ name: savedViews.name }).from(savedViews).where(mine);
    if (taken.some((v) => v.name.toLowerCase() === b.name.toLowerCase())) throw new ApiError("duplicate", "You already have a view with this name on this page. Pick another name.");
    if (taken.length >= MAX_SAVED_VIEWS) throw new ApiError("bad_request", `You have ${MAX_SAVED_VIEWS} saved views on this page. Delete one to save another.`);
    const [v] = await tx.insert(savedViews).values({ id: Bun.randomUUIDv7(), userId: ctx.user.id, path: b.path, name: b.name, query: b.query }).returning();
    return toDto(v!);
  });
}

/** Deletes one of the caller's views; another user's or an unknown id is 404. */
export async function deleteView(ctx: Ctx, id: string): Promise<void> {
  const gone = () => new ApiError("not_found", "This view doesn't exist or was already deleted.");
  if (!isUuid(id)) throw gone();
  const removed = await db.delete(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, ctx.user.id))).returning({ id: savedViews.id });
  if (!removed.length) throw gone();
}
