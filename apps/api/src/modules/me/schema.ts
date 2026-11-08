import { sql } from "drizzle-orm";
import { foreignKey, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "../users/schema";

/** Named list views a user saved (GET/POST/DELETE /v1/me/views): theirs only, at most MAX_SAVED_VIEWS per list page. */
export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  path: text("path").notNull(),
  name: text("name").notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ name: "saved_views_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  // Also serves the per-user, per-page list (its leading columns).
  uniqueIndex("saved_views_name_key").on(t.userId, t.path, sql`lower(${t.name})`),
]);
