// /v1/projects*. Query 400 → guard 401/403 → body 400 → 404 → change → activity (the last three in service.ts).
import { Elysia } from "elysia";
import { CreateProjectBody, ProjectListQuery, UpdateProjectBody } from "@starterkit/shared/contracts/projects";
import { notFound } from "../../kernel/errors";
import { body, idParam } from "../../kernel/parse";
import { guard } from "../auth";
import { createProject, deleteProject, projectById, projectPage, updateProject } from "./service";

/** The routes of /v1/projects*. */
export const projectsController = () =>
  new Elysia()
    .use(guard)
    /** One page of projects, name A–Z unless `sort` says otherwise; `q` matches the name, `status` is exact. */
    .get("/v1/projects", ({ query }) => projectPage(query), { query: ProjectListQuery, guard: "project.view" })
    .post("/v1/projects", async (c) => {
      const p = await createProject(c.ctx, await body(c, CreateProjectBody));
      c.set.status = 201;
      return p;
    }, { guard: "project.create" })
    .get("/v1/projects/:id", async ({ params }) => {
      const p = await projectById(idParam(params.id, "project"));
      if (!p) throw notFound("project");
      return p;
    }, { guard: "project.view" })
    .patch("/v1/projects/:id", async (c) => {
      const b = await body(c, UpdateProjectBody);
      return updateProject(c.ctx, idParam(c.params.id, "project"), b);
    }, { guard: "project.edit" })
    .delete("/v1/projects/:id", async ({ ctx, params }) => {
      await deleteProject(ctx, idParam(params.id, "project"));
      return { ok: true };
    }, { guard: "project.delete" });
