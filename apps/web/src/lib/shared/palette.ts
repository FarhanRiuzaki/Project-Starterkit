/** Independent from light/dark: each palette has both modes. */
export const PALETTES = [
  { value: "current", label: "Current" },
  { value: "mocha", label: "Mocha · Sky · Custard" },
  { value: "burgundy", label: "Burgundy · Carrot · Gold" },
  { value: "onyx", label: "Onyx · Slate · Alabaster" },
  { value: "espresso", label: "Espresso · Peach · Apricot" },
] as const;
export type Palette = (typeof PALETTES)[number]["value"];
export const PALETTE_COOKIE = "sk_palette";
export function parsePalette(value: string | undefined): Palette {
  return PALETTES.find((p) => p.value === value)?.value ?? "current";
}
export function paletteCookie(value: Palette, secure: boolean): string {
  return `${PALETTE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Strict${secure ? "; Secure" : ""}`;
}
