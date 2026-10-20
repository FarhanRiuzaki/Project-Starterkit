import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bytea } from "../../kernel/columns";
import { users } from "../users/schema";

const METHOD_CHECK = sql`method in ('password', 'ldap', 'google', 'apple')`;

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  tokenHash: bytea("token_hash").notNull().unique("sessions_token_hash_key"),
  userId: uuid("user_id").notNull(),
  method: text("method").notNull(),
  device: text("device").notNull(),
  ip: text("ip").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** Last time this session proved the user (sign-in, POST /v1/me/reauth): linking Google or Apple needs it recent. */
  reauthAt: timestamp("reauth_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ name: "sessions_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  check("sessions_method_check", METHOD_CHECK),
  index("sessions_user_id").on(t.userId),
  index("sessions_expires_at").on(t.expiresAt),
]);

/** A sign-in waiting for its second factor. */
export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey(),
  tokenHash: bytea("token_hash").notNull().unique("auth_challenges_token_hash_key"),
  userId: uuid("user_id").notNull(),
  method: text("method").notNull(),
  next: text("next"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  foreignKey({ name: "auth_challenges_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  check("auth_challenges_method_check", METHOD_CHECK),
  index("auth_challenges_user_id").on(t.userId),
]);

/** Reset and invitation links: one live link per user. */
export const userTokens = pgTable("user_tokens", {
  tokenHash: bytea("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().unique("user_tokens_user_id_key"),
  kind: text("kind").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  foreignKey({ name: "user_tokens_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  check("user_tokens_kind_check", sql`kind in ('reset', 'invite')`),
]);

// Rate limits and sign-in backoff: shared by every API process, UNLOGGED (drizzle/0001_custom.sql): not worth WAL,
// lost on a crash by design.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const loginBackoff = pgTable("login_backoff", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }).notNull(),
});
