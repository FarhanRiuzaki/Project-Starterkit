import { crossSite, sameOrigin } from "@/lib/server/api";
import { backend, relay } from "@/lib/server/backend";
import { bodyOf, tooLarge } from "@/lib/server/forward";

/** Set a new password with a reset or invitation token (`POST /v1/auth/reset`); the user's sessions end. */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  const body = await bodyOf(req);
  if (!body) return tooLarge();
  return relay(await backend("/v1/auth/reset", { method: "POST", body, contentType: "application/json", req }));
}
