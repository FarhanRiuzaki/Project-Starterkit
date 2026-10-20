import localFont from "next/font/local";

/**
 * Self-hosted variable fonts (spec §3.5): next/font emits the @font-face rules and serves the files from
 * /_next/static/media, so the CSP keeps `font-src 'self'` and nothing loads from a third-party origin.
 * Latin subset only: the console copy is English (copy guide); other scripts fall back to the system font.
 * `src` is a path relative to this file: next/font/local reads a bare specifier as a relative path too (no package
 * resolution), so the files are reached through apps/web/node_modules, where Bun links this app's own
 * dependencies (pinned in apps/web/package.json). fonts.test.ts fails `bun run check` if that path stops resolving.
 */
export const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

export const geistMono = localFont({
  src: "../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  adjustFontFallback: false,
});

/** Classes for <html>: expose the font variables to the token layer (globals.css → --font-sans / --font-mono). */
export const fontVariables = `${inter.variable} ${geistMono.variable}`;
