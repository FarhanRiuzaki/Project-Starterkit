import { sql } from "drizzle-orm";
import { bigint, boolean, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Ids are UUIDv7 made by the app (Bun.randomUUIDv7()). Case-insensitive uniqueness through lower() indexes; the
// trigram GIN indexes for ILIKE '%q%' search live in drizzle/0001_custom.sql (drizzle-kit can't express gin_trgm_ops).
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  isLdap: boolean("is_ldap").notNull().default(false),
  passwordHash: text("password_hash"),
  /** Encrypted (v1:…); not null = two-factor on. */
  totpSecret: text("totp_secret"),
  /** Encrypted; set by POST /me/2fa until PUT confirms a code. */
  pendingTotpSecret: text("pending_totp_secret"),
  /** TOTP step of the last accepted code (replay guard). */
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_username_key").on(sql`lower(${t.username})`),
  uniqueIndex("users_email_key").on(sql`lower(${t.email})`),
  index("users_created_at").on(t.createdAt),
  // GET /v1/users sort keys; never signed in sorts last both ways, so each direction of lastLoginAt has its own index.
  index("users_name_lower").on(sql`lower(${t.name})`, t.id),
  index("users_last_login_asc").on(sql`(${t.lastLoginAt} is null)`, t.lastLoginAt, t.id),
  index("users_last_login_desc").on(sql`(${t.lastLoginAt} is null)`, t.lastLoginAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
]);

export const recoveryCodes = pgTable("recovery_codes", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (t) => [
  foreignKey({ name: "recovery_codes_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  index("recovery_codes_user_id").on(t.userId),
]);
