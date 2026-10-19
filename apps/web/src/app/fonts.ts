import localFont from "next/font/local";

/**
 * Self-hosted variable fonts (spec §3.5): next/font emits the @font-face rules and serves the files from
 * /_next/static/media, so the CSP keeps `font-src 'self'` and nothing loads from a third-party origin.
 * Latin subset only: the console copy is English (copy guide); other scripts fall back to the system font.
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

/**
 * Geist for the brand wordmark only; the body stays Inter. Same self-hosted route as Inter: the file comes from
 * the pinned @fontsource-variable package that `bun install` installs, so the build needs no font download. One
 * latin variable file covers the wordmark weights 620 and 640; no static Geist weight exists at those values.
 */
export const geist = localFont({
  src: "../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
  weight: "620 640",
  style: "normal",
  display: "swap",
  variable: "--font-geist",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/** Classes for <html>: expose the font variables to the token layer (globals.css → --font-sans / --font-mono). */
export const fontVariables = `${inter.variable} ${geistMono.variable} ${geist.variable}`;
