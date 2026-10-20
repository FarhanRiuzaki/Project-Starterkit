// /v1/users* (/v1/users/roles is the rbac module's). Query 400 → guard 401/403 → body 400 → 404 → actor rank → rules →
// change → activity (from 404 on, in service.ts).
import { Elysia } from "elysia";
import { SessionListQuery } from "@starterkit/shared/contracts/me";
import { BulkUserBody, CreateUserBody, SetUserStatusBody, UpdateUserBody, UserListQuery } from "@starterkit/shared/contracts/users";
import { ApiError, notFound } from "../../kernel/errors";
import { body, idParam } from "../../kernel/parse";
import { guard, sessionPage } from "../auth";
import {
  bulkUsers, createUser, editUser, endSessionOf, removeUser, resetUserPassword, setUserStatus, userDetail, userExists, userPage,
} from "./service";

const OK = { ok: true } as const;

/** The routes of /v1/users*. */
export const usersController = () =>
  new Elysia()
    .use(guard)
    .get("/v1/users", ({ query }) => userPage(query), { query: UserListQuery, guard: "user.view" })
    /** New user with a password, an invitation (72 h set-password link, mailed after the commit) or neither (directory user). */
    .post("/v1/users", async (c) => {
      const dto = await createUser(c.ctx, await body(c, CreateUserBody));
      c.set.status = 201;
      return dto;
    }, { guard: "user.create" })
    /**
     * The action picks the permission (delete needs user.delete, the others user.edit), so the session is checked first
     * (401), then the body is read, then the permission (403); a bad body answers 400 after both, with user.edit.
     */
    .post("/v1/users/bulk", async (c) => {
      const parsed = await body(c, BulkUserBody).then((b) => ({ b }), (e: unknown) => ({ e }));
      if (!c.ctx.perms.has("b" in parsed && parsed.b.action === "delete" ? "user.delete" : "user.edit")) throw new ApiError("forbidden");
      if ("e" in parsed) throw parsed.e;
      return bulkUsers(c.ctx, parsed.b);
    }, { guard: null })
    /** The user; the last 20 activity entries targeting them need audit.view (no before/after snapshots). */
    .get("/v1/users/:id", ({ ctx, params }) => userDetail(idParam(params.id, "user"), ctx.perms.has("audit.view")), { guard: "user.view" })
    .patch("/v1/users/:id", async (c) => {
      const b = await body(c, UpdateUserBody);
      return editUser(c.ctx, idParam(c.params.id, "user"), b);
    }, { guard: "user.edit" })
    .delete("/v1/users/:id", async ({ ctx, params }) => {
      await removeUser(ctx, idParam(params.id, "user"));
      return OK;
    }, { guard: "user.delete" })
    /** Admin reset: a random password, shown once in the answer (never logged); the user's sessions end and their links are spent. */
    .post("/v1/users/:id/reset-password", async ({ ctx, params }) => ({ temporaryPassword: await resetUserPassword(ctx, idParam(params.id, "user")) }), { guard: "user.edit" })
    /** Activate or deactivate (the same rule and activity as PATCH isActive). Deactivating ends the user's sessions. */
    .post("/v1/users/:id/status", async (c) => {
      const { active } = await body(c, SetUserStatusBody);
      return setUserStatus(c.ctx, idParam(c.params.id, "user"), active);
    }, { guard: "user.edit" })
    /** One page of a user's live sessions, newest activity first unless `sort` says otherwise; the caller's own is marked current. */
    .get("/v1/users/:id/sessions", async ({ ctx, params, query }) => {
      const id = idParam(params.id, "user");
      if (!(await userExists(id))) throw notFound("user");
      return sessionPage(id, query, ctx.sid);
    }, { query: SessionListQuery, guard: "user.view" })
    /** End one session of another user. A session that isn't theirs answers like an unknown one. */
    .delete("/v1/users/:id/sessions/:sid", async ({ ctx, params }) => {
      await endSessionOf(ctx, params.id, params.sid);
      return OK;
    }, { guard: "user.edit" });
