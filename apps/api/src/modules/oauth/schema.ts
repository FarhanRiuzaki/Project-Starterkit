import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { bytea } from "../../kernel/columns";
import { sessions } from "../auth/schema";
import { users } from "../users/schema";

const PROVIDER_CHECK = sql`provider in ('google', 'apple')`;

export const userIdentities = pgTable("user_identities", {
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: "user_identities_pkey", columns: [t.provider, t.subject] }),
  unique("user_identities_user_id_provider_key").on(t.userId, t.provider),
  foreignKey({ name: "user_identities_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  check("user_identities_provider_check", PROVIDER_CHECK),
]);

export const oauthStates = pgTable("oauth_states", {
  stateHash: bytea("state_hash").primaryKey(),
  provider: text("provider").notNull(),
  mode: text("mode").notNull(),
  userId: uuid("user_id"),
  bindingHash: bytea("binding_hash").notNull(),
  codeVerifier: text("code_verifier").notNull(),
  nonce: text("nonce").notNull(),
  next: text("next"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /**
   * The session that started the round trip (link: required; login: the browser's earlier session, if any). Ending
   * that session (sign-out, revoke, expiry clean-up) deletes its pending states.
   */
  sessionId: uuid("session_id"),
}, (t) => [
  foreignKey({ name: "oauth_states_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  foreignKey({ name: "oauth_states_session_id_fkey", columns: [t.sessionId], foreignColumns: [sessions.id] }).onDelete("cascade"),
  check("oauth_states_provider_check", PROVIDER_CHECK),
  check("oauth_states_mode_check", sql`mode in ('login', 'link')`),
  index("oauth_states_user_id").on(t.userId),
]);
