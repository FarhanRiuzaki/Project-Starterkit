export type Prefs = { sidebar: "expanded" | "collapsed"; density: "comfortable" | "compact" };
export const PREFS_COOKIE = "sk_prefs";
export const DEFAULT_PREFS: Prefs = { sidebar: "expanded", density: "comfortable" };

/** Viewer preference from the cookie value; anything unknown falls back to the default. */
export function parsePrefs(raw: string | undefined): Prefs {
  const q = new URLSearchParams(raw ?? "");
  return {
    sidebar: q.get("sidebar") === "collapsed" ? "collapsed" : "expanded",
    density: q.get("density") === "compact" ? "compact" : "comfortable",
  };
}

export function prefsCookie(p: Prefs, secure: boolean): string {
  const v = new URLSearchParams({ sidebar: p.sidebar, density: p.density }).toString();
  return `${PREFS_COOKIE}=${encodeURIComponent(v)}; Path=/; Max-Age=31536000; SameSite=Strict${secure ? "; Secure" : ""}`;
}
