import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Providers } from "@/components/providers";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Starterkit", description: "Starterkit" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request: Next stamps the proxy's CSP nonce on its scripts only in dynamic rendering (a prerendered
  // page's scripts would carry no nonce and be blocked by 'strict-dynamic').
  await connection();
  // The same nonce goes on next-themes' inline script, which sets the theme class before first paint.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body className="min-h-screen font-sans"><Providers nonce={nonce}>{children}</Providers></body>
    </html>
  );
}
