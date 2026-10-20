import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { jsonb } from "../../kernel/columns";

// Actor and target are copied as they were (no foreign keys), so entries outlive what they name. Both tables are
// append-only: an UPDATE raises (trigger in drizzle/0001_custom.sql).
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid("actor_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  targetLabel: text("target_label").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
}, (t) => [
  index("activity_at").on(t.at.desc().nullsFirst(), t.id.desc().nullsFirst()),
  index("activity_target").on(t.targetId, t.at.desc().nullsFirst()),
  index("activity_action").on(t.action, t.at.desc().nullsFirst()),
  // A user's own activity, newest first.
  index("activity_actor_at").on(t.actorId, t.at.desc().nullsFirst()),
]);

export const authLog = pgTable("auth_log", {
  id: uuid("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  event: text("event").notNull(),
  login: text("login").notNull(),
  userId: uuid("user_id"),
  method: text("method").notNull(),
  ip: text("ip").notNull(),
  device: text("device").notNull(),
  location: text("location"),
}, (t) => [
  check("auth_log_event_check", sql`event in ('login_success', 'password_ok', 'login_failed', 'logout', '2fa_success', '2fa_failed', 'password_reset')`),
  check("auth_log_method_check", sql`method in ('password', 'ldap', 'google', 'apple')`),
  index("auth_log_at").on(t.at.desc().nullsFirst(), t.id.desc().nullsFirst()),
  index("auth_log_user").on(t.userId, t.at.desc().nullsFirst()),
  index("auth_log_event").on(t.event, t.at.desc().nullsFirst()),
]);
