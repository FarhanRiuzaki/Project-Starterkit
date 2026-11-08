// /v1/me*. Every route is any signed-in user's (`guard: null`): query 400 →
// session 401 → body 400 → 404 → rules → change → activity (the last three in service.ts).
import { Elysia } from "elysia";
import {
  ChangePasswordBody, ConnectionProvider, CreateSavedViewBody, DisableTwoFactorBody, ReauthBody, SavedViewListQuery, SessionListQuery,
  TwoFactorEnableBody, UpdateProfileBody,
} from "@starterkit/shared/contracts/me";
import { body } from "../../kernel/parse";
import { guard, sessionPage } from "../auth";
import {
  changePassword, confirmIdentity, disableTwoFactor, disconnect, enableTwoFactor, endOwnSession, startTwoFactor, toMe, updateProfile,
} from "./service";
import { deleteView, saveView, viewPage } from "./views";

const OK = { ok: true } as const;

/** The routes of /v1/me. */
export const meController = () =>
  new Elysia()
    .use(guard)
    .get("/v1/me", ({ ctx }) => toMe(ctx.user, ctx.reauthFresh), { guard: null })
    .patch("/v1/me", async (c) => updateProfile(c.ctx, await body(c, UpdateProfileBody)), { guard: null })
    .post("/v1/me/password", async (c) => {
      await changePassword(c.ctx, await body(c, ChangePasswordBody));
      return OK;
    }, { guard: null })
    .post("/v1/me/2fa", ({ ctx }) => startTwoFactor(ctx), { guard: null })
    .put("/v1/me/2fa", async (c) => enableTwoFactor(c.ctx, await body(c, TwoFactorEnableBody)), { guard: null })
    .delete("/v1/me/2fa", async (c) => {
      await disableTwoFactor(c.ctx, await body(c, DisableTwoFactorBody));
      return OK;
    }, { guard: null })
    /** Proves the user again on this session (connecting Google or Apple needs it within 10 minutes); no activity entry. */
    .post("/v1/me/reauth", async (c) => {
      await confirmIdentity(c.ctx, await body(c, ReauthBody));
      return OK;
    }, { guard: null })
    .delete("/v1/me/connections/:provider", ({ ctx, params }) => disconnect(ctx, ConnectionProvider.parse(params.provider)), { guard: null })
    /** One page of the caller's own sessions, newest activity first unless `sort` says otherwise. */
    .get("/v1/me/sessions", ({ ctx, query }) => sessionPage(ctx.user.id, query, ctx.sid), { query: SessionListQuery, guard: null })
    .delete("/v1/me/sessions/:id", async ({ ctx, params }) => {
      await endOwnSession(ctx, params.id);
      return OK;
    }, { guard: null })
    /** The caller's saved views of one list page (`path`); saving and deleting one records no activity (a preference). */
    .get("/v1/me/views", ({ ctx, query }) => viewPage(ctx.user.id, query), { query: SavedViewListQuery, guard: null })
    .post("/v1/me/views", async (c) => saveView(c.ctx, await body(c, CreateSavedViewBody)), { guard: null })
    .delete("/v1/me/views/:id", async ({ ctx, params }) => {
      await deleteView(ctx, params.id);
      return OK;
    }, { guard: null });
