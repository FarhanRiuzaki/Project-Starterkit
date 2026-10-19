import { apiError, badRequest, handleError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { db } from "@/lib/server/mock/db";
import { paginate } from "@/lib/server/paginate";
import { listPermissions, permissionSorters } from "@/lib/server/rbac";
import { CATALOG_MAX, CreatePermissionsBody, type CreatePermissionsResult, PermissionListQuery } from "@/lib/shared/contracts/rbac";

/** One page of the catalog, catalog order unless `sort` says otherwise; `q` matches the name, `module` is exact. */
export async function GET(req: Request): Promise<Response> {
  const parsed = PermissionListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "permission.view", async () => {
    const all = listPermissions();
    const needle = q.q?.trim().toLowerCase();
    const rows = all.filter((p) => (!needle || p.name.includes(needle)) && (!q.module || p.name.startsWith(`${q.module}.`)));
    return json(paginate(rows, q, permissionSorters(all), "module"));
  });
}

/**
 * Add `<module>.<action>` names to the catalog; names already in it are skipped. Roles can't hold an added name yet
 * (role bodies accept PermissionName only).
 */
// ponytail: catalog grows in the mock store only; a fully dynamic catalog (grantable, guardable names) is a backend concern.
export async function POST(req: Request): Promise<Response> {
  const body = CreatePermissionsBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, "permission.create", async (ctx) => {
    if (!body.success) return badRequest();
    const catalog = db().permissionCatalog;
    const fresh = new Set(body.data.names.filter((n) => !catalog.has(n)));
    if (catalog.size + fresh.size > CATALOG_MAX) return apiError(400, "bad_request", `The list can hold at most ${CATALOG_MAX} permissions. Add fewer names.`);
    const res: CreatePermissionsResult = { created: [], skipped: [] };
    for (const name of new Set(body.data.names)) {
      if (catalog.has(name)) res.skipped.push(name);
      else { catalog.add(name); res.created.push(name); }
    }
    if (res.created.length) recordActivity(ctx, { action: "permission.create", target: { type: "permission", id: res.created.join(","), label: res.created.join(", ") }, after: { created: res.created } });
    return json(res);
  });
}
