import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { Providers } from "@/components/providers";
import { BRAND } from "@starterkit/shared/brand";
import { PREFS_COOKIE, parsePrefs } from "@/lib/shared/prefs";
import { fontVariables } from "./fonts";
import "./globals.css";

/** Pages give only their own title; the product name comes from BRAND (one place to rename the product). */
export const metadata: Metadata = { title: { template: `%s · ${BRAND.name}`, default: BRAND.name }, description: BRAND.name };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request: Next stamps the proxy's CSP nonce on its scripts only in dynamic rendering (a prerendered
  // page's scripts would carry no nonce and be blocked by 'strict-dynamic').
  await connection();
  // The same nonce goes on next-themes' inline script, which sets the theme class before first paint.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Density from the viewer's cookie, so compact survives a reload (tokens.css keys on :root[data-density]).
  const density = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value).density;
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables} data-density={density}>
      <body className="min-h-screen font-sans"><Providers nonce={nonce}>{children}</Providers></body>
    </html>
  );
}
