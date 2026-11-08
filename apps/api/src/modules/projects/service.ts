// Projects: the logic of /v1/projects*. 404 → change → activity entry, in one transaction per change.
import { and, eq, ilike, sql } from "drizzle-orm";
import type { Page } from "@starterkit/shared/contracts/common";
import type { CreateProjectBody, ProjectDto, ProjectListQuery, ProjectStatus, UpdateProjectBody } from "@starterkit/shared/contracts/projects";
import { db, type Tx } from "../../kernel/db";
import { ApiError, isUniqueViolation, notFound } from "../../kernel/errors";
import { likeEscape, one, pageQuery, sortSql } from "../../kernel/pagination";
import { recordActivity } from "../audit";
import type { Ctx } from "../auth";
import { projectChanges } from "./rules";
import { projects } from "./schema";

const NOW = sql`now()`;
const DUPLICATE = () => new ApiError("duplicate", "Another project already has this name. Use a different one.");

type Row = typeof projects.$inferSelect;
const dto = (r: Row): ProjectDto => ({
  id: r.id, name: r.name, description: r.description, status: r.status as ProjectStatus, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
});

/** One page of projects (GET /v1/projects), name A–Z unless `sort` says otherwise; `q` matches the name, `status` is exact. */
export function projectPage(q: ProjectListQuery): Promise<Page<ProjectDto>> {
  const where = and(
    q.q?.trim() ? ilike(projects.name, `%${likeEscape(q.q.trim())}%`) : undefined,
    q.status ? eq(projects.status, q.status) : undefined,
  );
  return pageQuery({
    rows: db.select().from(projects).where(where).$dynamic(),
    count: db.select(one).from(projects).where(where).$dynamic(),
    orderBy: sortSql(q.sort, { name: sql`lower(${projects.name})`, createdAt: projects.createdAt }, "name", projects.id),
    query: q,
    map: dto,
  });
}

/** One project; null = no such project. */
export async function projectById(id: string): Promise<ProjectDto | null> {
  const [r] = await db.select().from(projects).where(eq(projects.id, id));
  return r ? dto(r) : null;
}

/** New project; the name is unique ignoring letter case. */
export async function createProject(ctx: Ctx, b: CreateProjectBody): Promise<ProjectDto> {
  return db.transaction(async (tx) => {
    let row: Row;
    try {
      [row] = await tx.insert(projects).values({ id: Bun.randomUUIDv7(), name: b.name, description: b.description || null, status: b.status }).returning() as [Row];
    } catch (e) {
      throw isUniqueViolation(e) ? DUPLICATE() : e; // the only unique key a new id can hit is lower(name)
    }
    const p = dto(row);
    await recordActivity(tx, ctx, { action: "project.create", target: { type: "project", id: p.id, label: p.name }, after: p });
    return p;
  });
}

/** Locks project `id` for the transaction; its row, or 404. */
async function lockProject(tx: Tx, id: string): Promise<Row> {
  const [r] = await tx.select().from(projects).where(eq(projects.id, id)).for("update");
  if (!r) throw notFound("project");
  return r;
}

/** Changes the fields sent; one `project.update` entry with the changed fields only. Nothing to change → the project, no entry. */
export async function updateProject(ctx: Ctx, id: string, b: UpdateProjectBody): Promise<ProjectDto> {
  return db.transaction(async (tx) => {
    const cur = dto(await lockProject(tx, id));
    const change = projectChanges(cur, b);
    if (!change) return cur;
    let row: Row;
    try {
      [row] = await tx.update(projects).set({ ...change.after, updatedAt: NOW }).where(eq(projects.id, id)).returning() as [Row];
    } catch (e) {
      throw isUniqueViolation(e) ? DUPLICATE() : e;
    }
    const p = dto(row);
    await recordActivity(tx, ctx, { action: "project.update", target: { type: "project", id, label: p.name }, before: change.before, after: change.after });
    return p;
  });
}

/** Deletes a project; its entry keeps what it was. */
export async function deleteProject(ctx: Ctx, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const p = dto(await lockProject(tx, id));
    await tx.delete(projects).where(eq(projects.id, id));
    await recordActivity(tx, ctx, { action: "project.delete", target: { type: "project", id, label: p.name }, before: p });
  });
}
