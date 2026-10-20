import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { Providers } from "@/components/providers";
import { BRAND } from "@starterkit/shared/brand";
import { config } from "@/lib/server/config";
import { PREFS_COOKIE, parsePrefs } from "@/lib/shared/prefs";
import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * Pages give only their own title; the product name comes from BRAND (one place to rename the product). metadataBase
 * (absolute og:image and icon URLs) comes from the runtime APP_URL, so it is read per request, not at build time.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { metadataBase: new URL(config().APP_URL), title: { template: `%s · ${BRAND.name}`, default: BRAND.name }, description: BRAND.name };
}

/** viewport-fit=cover: the page runs under a phone's notch and home indicator; the shell pads with the safe-area insets (base.css `*-safe`). */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

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
      {/* The page streams in after the shell as a Suspense segment (loading.tsx). If the browser paints a frame before
          React's reveal script runs, React holds the page back 300 ms past that frame ($RT throttle) and the region
          paints blank. No element has this id, so first paint waits for the end of the document and the page shows on
          it (Chromium; elsewhere the link is ignored). */}
      <head><link rel="expect" href="#document-parsed" blocking="render" /></head>
      <body className="min-h-screen font-sans"><Providers nonce={nonce}>{children}</Providers></body>
    </html>
  );
}
