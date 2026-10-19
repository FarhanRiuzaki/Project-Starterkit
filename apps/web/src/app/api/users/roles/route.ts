import { handleError, json, withPermission } from "@/lib/server/api";
import { roleOptionPage } from "@/lib/server/users";
import { RoleOptionQuery } from "@/lib/shared/contracts/rbac";

/** Role options for the user filter and forms, under user.view: one page of { id, name }, name A–Z; `q` matches the name. */
export async function GET(req: Request): Promise<Response> {
  const parsed = RoleOptionQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  return withPermission(req, "user.view", async () => json(roleOptionPage(parsed.data)));
}
