/**
 * `views`: the last table view (filters, sort, rows per page) of each list page, so the navigation reopens a list
 * as it was left (the server reads the cookie, so the page renders filtered on first paint). Never the page number or
 * the search text: those belong to one visit.
 */
export type Prefs = { sidebar: "expanded" | "collapsed"; density: "comfortable" | "compact"; views: Partial<Record<ViewPage, string>> };
export const PREFS_COOKIE = "sk_prefs";
export const DEFAULT_PREFS: Prefs = { sidebar: "expanded", density: "comfortable", views: {} };

/** The list pages whose view is remembered (each a `useTableQuery` screen). */
export const VIEW_PAGES = ["/users", "/roles", "/permissions", "/audit/activity", "/audit/auth"] as const;
export type ViewPage = (typeof VIEW_PAGES)[number];
const VIEW_MAX = 300; // characters per view: the whole cookie stays far under the 4 KB limit
const isViewPage = (p: string): p is ViewPage => (VIEW_PAGES as readonly string[]).includes(p);

/** A table's URL query as it is remembered: without the page and the search keys; "" = the defaults. */
export function savedView(sp: URLSearchParams, search: readonly string[] = []): string {
  const q = new URLSearchParams(sp);
  for (const k of ["page", ...search]) q.delete(k);
  return q.toString();
}

/** Viewer preference from the cookie value; anything unknown falls back to the default. */
export function parsePrefs(raw: string | undefined): Prefs {
  const q = new URLSearchParams(raw ?? "");
  const views: Prefs["views"] = {};
  for (const p of VIEW_PAGES) {
    const v = savedView(new URLSearchParams(q.get(`view:${p}`) ?? ""));
    if (v && v.length <= VIEW_MAX) views[p] = v;
  }
  return {
    sidebar: q.get("sidebar") === "collapsed" ? "collapsed" : "expanded",
    density: q.get("density") === "compact" ? "compact" : "comfortable",
    views,
  };
}

export function prefsCookie(p: Prefs, secure: boolean): string {
  const q = new URLSearchParams({ sidebar: p.sidebar, density: p.density });
  for (const [page, v] of Object.entries(p.views)) if (v && isViewPage(page) && v.length <= VIEW_MAX) q.set(`view:${page}`, v);
  return `${PREFS_COOKIE}=${encodeURIComponent(q.toString())}; Path=/; Max-Age=31536000; SameSite=Strict${secure ? "; Secure" : ""}`;
}

/** A navigation link to `href`, reopening its remembered view (the query is re-encoded, so it can't change the path). */
export function viewHref(href: string, prefs: Prefs): string {
  const v = isViewPage(href) ? prefs.views[href] : undefined;
  const q = v ? new URLSearchParams(v).toString() : "";
  return q ? `${href}?${q}` : href;
}
