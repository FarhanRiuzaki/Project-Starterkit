import { handleError, json, withPermission } from "@/lib/server/api";
import { db } from "@/lib/server/mock/db";
import { paginate } from "@/lib/server/paginate";
import { type RoleOption, RoleOptionQuery } from "@/lib/shared/contracts/rbac";

/** Role options for the user filter and forms, under user.view: one page of { id, name }, name A–Z; `q` matches the name. */
export async function GET(req: Request): Promise<Response> {
  const parsed = RoleOptionQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "user.view", async () => {
    const needle = q.q?.trim().toLowerCase();
    const rows: RoleOption[] = [...db().roles.values()].filter((r) => !needle || r.name.toLowerCase().includes(needle)).map((r) => ({ id: r.id, name: r.name }));
    return json(paginate(rows, q, { name: (r) => r.name }, "name"));
  });
}
