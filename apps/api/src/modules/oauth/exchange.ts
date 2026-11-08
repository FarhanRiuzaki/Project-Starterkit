// Arctic 3.7 creates authorize URLs but does not expose an abortable token exchange.
// Keep the two existing providers' wire formats, with a deadline and bounded response body.
import type { ConnectionProvider } from "@starterkit/shared/contracts/me";
import { importPKCS8, SignJWT } from "jose";
import type { Config } from "../../kernel/config";

const ENDPOINT = { google: "https://oauth2.googleapis.com/token", apple: "https://appleid.apple.com/auth/token" };

export async function exchangeCode(p: ConnectionProvider, code: string, verifier: string, c: Config): Promise<string> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${c.APP_URL}/api/auth/oauth/${p}/callback` });
  const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" });
  if (p === "google") {
    body.set("code_verifier", verifier);
    headers.set("Authorization", `Basic ${Buffer.from(`${c.GOOGLE_CLIENT_ID!}:${c.GOOGLE_CLIENT_SECRET!}`).toString("base64")}`);
  } else {
    const pem = c.APPLE_PRIVATE_KEY!.replaceAll("\\n", "\n").trim();
    const key = await importPKCS8(pem, "ES256");
    const secret = await new SignJWT({}).setProtectedHeader({ alg: "ES256", typ: "JWT", kid: c.APPLE_KEY_ID! })
      .setIssuer(c.APPLE_TEAM_ID!).setSubject(c.APPLE_CLIENT_ID!).setAudience(["https://appleid.apple.com"])
      .setIssuedAt().setExpirationTime("5m").sign(key);
    body.set("client_id", c.APPLE_CLIENT_ID!);
    body.set("client_secret", secret);
  }
  const response = await fetch(new Request(ENDPOINT[p], { method: "POST", headers, body, redirect: "error", signal: AbortSignal.timeout(10_000) }));
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("Provider rejected token exchange");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64 * 1024) {
      await reader.cancel();
      throw new Error("Provider token response exceeds limit");
    }
    chunks.push(value);
  }
  const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!data || typeof data !== "object" || !("id_token" in data) || typeof data.id_token !== "string") throw new Error("Provider omitted id_token");
  return data.id_token;
}
