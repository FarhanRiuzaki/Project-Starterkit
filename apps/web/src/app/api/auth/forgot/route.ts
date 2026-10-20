import { crossSite, sameOrigin } from "@/lib/server/api";
import { backend, relay } from "@/lib/server/backend";
import { bodyOf, tooLarge } from "@/lib/server/forward";

/** Request a reset link (`POST /v1/auth/forgot`): the same answer for any email, throttled or not. */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  const body = await bodyOf(req);
  if (!body) return tooLarge();
  return relay(await backend("/v1/auth/forgot", { method: "POST", body, contentType: "application/json", req }));
}
