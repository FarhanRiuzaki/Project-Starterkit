import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Ids are UUIDv7 made by the app. Names are unique ignoring letter case (lower() index, which also serves the name
// sort); the trigram GIN index for ILIKE '%q%' search is custom SQL in drizzle/ (drizzle-kit can't express gin_trgm_ops).
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("projects_name_key").on(sql`lower(${t.name})`),
  index("projects_created_at").on(t.createdAt, t.id),
  check("projects_status_check", sql`${t.status} in ('active', 'archived')`),
]);
