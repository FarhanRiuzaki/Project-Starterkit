import { crossSite, sameOrigin } from "@/lib/server/api";
import { backend, relay } from "@/lib/server/backend";

/** Request a reset link (`POST /v1/auth/forgot`): the same answer for any email, throttled or not. */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  return relay(await backend("/v1/auth/forgot", { method: "POST", body: await req.text(), contentType: "application/json", req }));
}
