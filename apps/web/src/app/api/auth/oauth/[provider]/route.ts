import { backend, relay } from "@/lib/server/backend";
import { getSession, storeSignIn } from "@/lib/server/session";

/**
 * Mock OAuth until Task 10's provider flow: `POST /v1/auth/oauth/{provider}/mock-login` (API with OAUTH_MOCK=true
 * only) signs in the demo account linked to the provider; the cookie gets the session and the browser a 303 to `next`
 * (relative, internal only: the API checks it). The provider counts as the second factor.
 */
// ponytail: no OAuth state/nonce (nothing leaves the app); Task 10 replaces this with the real redirect flow.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  const next = new URL(req.url).searchParams.get("next");
  const res = await backend(`/v1/auth/oauth/${encodeURIComponent(provider)}/mock-login${next ? `?${new URLSearchParams({ next })}` : ""}`, { method: "POST", req });
  if (!res.ok) return relay(res);
  const got = (await res.json()) as { next: string; token: string };
  await storeSignIn(await getSession(), { token: got.token }, req);
  return new Response(null, { status: 303, headers: { Location: got.next, "Cache-Control": "no-store" } });
}
