// /v1/roles, /v1/permissions and /v1/users/roles. Query 400 → guard 401/403 → body 400 → 404 → rules → change →
// activity (the last three in service.ts).
import { Elysia } from "elysia";
import { CreatePermissionsBody, CreateRoleBody, PermissionListQuery, RoleListQuery, RoleOptionQuery, UpdateRoleBody } from "@starterkit/shared/contracts/rbac";
import { notFound } from "../../kernel/errors";
import { body, idParam } from "../../kernel/parse";
import { guard } from "../auth";
import { createPermissions, createRole, deleteRole, permissionPage, roleById, roleOptionPage, rolePage, updateRole } from "./service";

/** The routes of /v1/roles and /v1/permissions, and the role options of /v1/users/roles. */
export const rbacController = () =>
  new Elysia()
    .use(guard)
    /**
     * Role options for the user filter and forms, under user.view: one page of { id, name }, name A–Z; `q` matches the
     * name. The registry mounts this module before users, whose /v1/users/:id must not take this path.
     */
    .get("/v1/users/roles", ({ query }) => roleOptionPage(query), { query: RoleOptionQuery, guard: "user.view" })
    /** One page of roles, name A–Z unless `sort` says otherwise; `q` matches the name. */
    .get("/v1/roles", ({ query }) => rolePage(query), { query: RoleListQuery, guard: "role.view" })
    .post("/v1/roles", async (c) => {
      const role = await createRole(c.ctx, await body(c, CreateRoleBody));
      c.set.status = 201;
      return role;
    }, { guard: "role.create" })
    .get("/v1/roles/:id", async ({ params }) => {
      const role = await roleById(idParam(params.id, "role"));
      if (!role) throw notFound("role");
      return role;
    }, { guard: "role.view" })
    .patch("/v1/roles/:id", async (c) => {
      const b = await body(c, UpdateRoleBody);
      return updateRole(c.ctx, idParam(c.params.id, "role"), b);
    }, { guard: "role.edit" })
    .delete("/v1/roles/:id", async ({ ctx, params }) => {
      await deleteRole(ctx, idParam(params.id, "role"));
      return { ok: true };
    }, { guard: "role.delete" })
    /** One page of the catalog, catalog order unless `sort` says otherwise; `q` matches the name, `module` is exact. */
    .get("/v1/permissions", ({ query }) => permissionPage(query), { query: PermissionListQuery, guard: "permission.view" })
    .post("/v1/permissions", async (c) => createPermissions(c.ctx, [...new Set((await body(c, CreatePermissionsBody)).names)]), { guard: "permission.create" });
