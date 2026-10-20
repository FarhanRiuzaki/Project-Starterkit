import { apiError } from "@/lib/server/api";
import { config } from "@/lib/server/config";
import { isProvider, seeOther } from "@/lib/server/oauth";

/**
 * The mock provider's authorize page (OAUTH_MOCK only, else 404): approves at once and sends the browser to the
 * callback with `code=mock`, as a provider would with its code. The API accepts that code only under its own OAUTH_MOCK.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  if (!config().OAUTH_MOCK || !isProvider(provider)) return apiError(404, "not_found", "This page doesn't exist or was deleted.");
  const state = new URL(req.url).searchParams.get("state") ?? "";
  return seeOther(`/api/auth/oauth/${provider}/callback?${new URLSearchParams({ code: "mock", state })}`);
}
