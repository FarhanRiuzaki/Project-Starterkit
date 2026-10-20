import { crossSite, sameOrigin } from "@/lib/server/api";
import { backend, relay } from "@/lib/server/backend";

/** Set a new password with a reset or invitation token (`POST /v1/auth/reset`); the user's sessions end. */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  return relay(await backend("/v1/auth/reset", { method: "POST", body: await req.text(), contentType: "application/json", req }));
}
