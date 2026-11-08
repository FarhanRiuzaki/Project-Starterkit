import { z } from "zod";
import { filterSelection } from "./filter-selection";
import { PROJECT_SORTS } from "../paging";
import { PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX, PROJECT_STATUSES } from "../projects";
import { ListQuery, sortParam } from "./common";

export { type ProjectStatus } from "../projects";

export const ProjectDto = z.object({
  id: z.string(),
  name: z.string(),
  /** null when the project has none. */
  description: z.string().nullable(),
  status: z.enum(PROJECT_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectDto = z.infer<typeof ProjectDto>;

export { PROJECT_SORTS };

/** GET /api/projects: `q` matches the name; `status` is exact. */
export const ProjectListQuery = ListQuery.extend({ sort: sortParam(PROJECT_SORTS), status: filterSelection(z.enum(PROJECT_STATUSES)).optional() });
export type ProjectListQuery = z.infer<typeof ProjectListQuery>;

const name = z.string().trim().min(1).max(PROJECT_NAME_MAX);
/** An empty description (after trimming) is stored as none. */
const description = z.string().trim().max(PROJECT_DESCRIPTION_MAX);

export const CreateProjectBody = z.object({ name, description: description.default(""), status: z.enum(PROJECT_STATUSES).default("active") });
export type CreateProjectBody = z.infer<typeof CreateProjectBody>;

/** Only the fields sent change; nothing to change → 200 with the project, no activity entry. */
export const UpdateProjectBody = z.strictObject({ name: name.optional(), description: description.optional(), status: z.enum(PROJECT_STATUSES).optional() });
export type UpdateProjectBody = z.infer<typeof UpdateProjectBody>;
