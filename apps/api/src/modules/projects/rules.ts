import type { ProjectDto, UpdateProjectBody } from "@starterkit/shared/contracts/projects";

type Editable = Pick<ProjectDto, "name" | "description" | "status">;

/**
 * The fields of `b` that differ from `cur`, as the activity entry's before / after (changed fields only); null when
 * nothing changes. An empty description means none (null). A name that differs only in letter case is a change.
 */
export function projectChanges(cur: Editable, b: UpdateProjectBody): { before: Partial<Editable>; after: Partial<Editable> } | null {
  const next: Editable = {
    name: b.name ?? cur.name,
    description: b.description === undefined ? cur.description : b.description || null,
    status: b.status ?? cur.status,
  };
  const keys = (Object.keys(next) as (keyof Editable)[]).filter((k) => next[k] !== cur[k]);
  if (!keys.length) return null;
  const pick = (o: Editable) => Object.fromEntries(keys.map((k) => [k, o[k]])) as Partial<Editable>;
  return { before: pick(cur), after: pick(next) };
}
