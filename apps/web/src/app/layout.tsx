import type { Metadata } from "next";
import { connection } from "next/server";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Starterkit", description: "Starterkit" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request: Next stamps the proxy's CSP nonce on its scripts only in dynamic rendering (a prerendered
  // page's scripts would carry no nonce and be blocked by 'strict-dynamic').
  await connection();
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
