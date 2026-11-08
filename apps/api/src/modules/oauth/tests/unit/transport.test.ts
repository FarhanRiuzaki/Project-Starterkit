import { expect, it, spyOn } from "bun:test";
import { config } from "../../../../kernel/config";
import { identityOf } from "../../providers";

const provider = () => ({ ...config(), OAUTH_MOCK: false, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-client-secret" });
const state = { verifier: "test-verifier", nonce: "test-nonce", userId: null };

it("token exchange aborts a stalled provider request with a fixed public error", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  const clock = spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(10));
  let aborted = false;
  const transport = spyOn(globalThis, "fetch").mockImplementation((async (request: Request) => new Promise<Response>((resolve, reject) => {
    const fallback = setTimeout(() => resolve(new Response(null, { status: 500 })), 50);
    request.signal.addEventListener("abort", () => {
      clearTimeout(fallback);
      aborted = true;
      reject(request.signal.reason);
    }, { once: true });
  })) as typeof fetch);
  try {
    const failure = await identityOf("google", "dummy-code", state, provider()).catch(error => error);
    expect(failure).toMatchObject({ code: "invalid_credentials" });
    expect(aborted).toBe(true);
    expect(clock).toHaveBeenCalledWith(10_000);
  } finally { transport.mockRestore(); clock.mockRestore(); }
});

it("token exchange rejects redirects and cancels an oversized response body", async () => {
  let redirect: Request["redirect"] | undefined;
  let canceled = false;
  const transport = spyOn(globalThis, "fetch").mockImplementation((async (request: Request) => {
    redirect = request.redirect;
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(70_000)); },
      cancel() { canceled = true; },
    }));
  }) as typeof fetch);
  try {
    const failure = await identityOf("google", "dummy-code", state, provider()).catch(error => error);
    expect(failure).toMatchObject({ code: "invalid_credentials" });
    expect(redirect).toBe("error");
    expect(canceled).toBe(true);
  } finally { transport.mockRestore(); }
});
