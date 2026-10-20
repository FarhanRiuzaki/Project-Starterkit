import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "../users/schema";

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  locked: boolean("locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("roles_name_key").on(sql`lower(${t.name})`)]);

/** The permission catalog; `position` = catalog order. */
export const permissions = pgTable("permissions", {
  name: text("name").primaryKey(),
  position: integer("position").notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull(),
  permission: text("permission").notNull(),
}, (t) => [
  primaryKey({ name: "role_permissions_pkey", columns: [t.roleId, t.permission] }),
  foreignKey({ name: "role_permissions_role_id_fkey", columns: [t.roleId], foreignColumns: [roles.id] }).onDelete("cascade"),
  foreignKey({ name: "role_permissions_permission_fkey", columns: [t.permission], foreignColumns: [permissions.name] }),
]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull(),
  roleId: uuid("role_id").notNull(),
}, (t) => [
  primaryKey({ name: "user_roles_pkey", columns: [t.userId, t.roleId] }),
  foreignKey({ name: "user_roles_user_id_fkey", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  foreignKey({ name: "user_roles_role_id_fkey", columns: [t.roleId], foreignColumns: [roles.id] }).onDelete("restrict"),
  index("user_roles_role_id").on(t.roleId),
]);
