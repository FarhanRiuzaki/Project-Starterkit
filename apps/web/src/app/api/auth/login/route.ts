import { crossSite, json, sameOrigin } from "@/lib/server/api";
import { backend, relay } from "@/lib/server/backend";
import { bodyOf, tooLarge } from "@/lib/server/forward";
import { getSession, storeSignIn } from "@/lib/server/session";

/**
 * Sign-in step 1, checked by the API (`POST /v1/auth/login`). Success: the cookie gets the session token and a new
 * CSRF token, or only the challenge when a second factor is due; the browser gets `{ next }`, never a token. A
 * failure passes through as the API answered (status, body, Retry-After) and leaves the cookie as it was.
 */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  const body = await bodyOf(req);
  if (!body) return tooLarge();
  const res = await backend("/v1/auth/login", { method: "POST", body, contentType: "application/json", req });
  if (!res.ok) return relay(res);
  const { next, token, challenge } = (await res.json()) as { next: string; token?: string; challenge?: string };
  await storeSignIn(await getSession(), { token, challenge }, req);
  return json({ next });
}
