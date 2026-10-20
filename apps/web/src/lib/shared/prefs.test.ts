import { describe, expect, it } from "vitest";
import { NAV } from "./nav";
import { parsePrefs, prefsCookie, savedView, VIEW_PAGES, viewHref, DEFAULT_PREFS } from "./prefs";

const value = (cookie: string) => decodeURIComponent(cookie.split(";")[0]!.split("=").slice(1).join("="));

describe("prefs cookie", () => {
  it("round-trips compact density and collapsed sidebar", () => {
    const c = prefsCookie({ sidebar: "collapsed", density: "compact", views: {}, hidden: {} }, false);
    expect(parsePrefs(value(c))).toEqual({ sidebar: "collapsed", density: "compact", views: {}, hidden: {} });
  });
  it("missing or unknown values fall back to comfortable/expanded", () => {
    expect(parsePrefs(undefined)).toEqual({ sidebar: "expanded", density: "comfortable", views: {}, hidden: {} });
    expect(parsePrefs("density=huge&sidebar=x")).toEqual({ sidebar: "expanded", density: "comfortable", views: {}, hidden: {} });
  });
});

describe("remembered table views", () => {
  it("every remembered list page is a navigation page (its link is the one that reopens the view)", () => {
    for (const p of VIEW_PAGES) expect(NAV.map((n) => n.href)).toContain(p);
  });
  it("round-trip through the cookie for the list pages only", () => {
    const views = { "/users": "role=Admin&sort=-createdAt", "/audit/activity": "range=30d&pageSize=50" };
    expect(parsePrefs(value(prefsCookie({ sidebar: "expanded", density: "comfortable", views, hidden: {} }, false))).views).toEqual(views);
    expect(parsePrefs(new URLSearchParams({ "view:/me": "a=1", "view:/users/x": "b=2" }).toString()).views).toEqual({});
  });
  it("a cookie value is normalized, drops the page, and an oversized one is ignored", () => {
    expect(parsePrefs(new URLSearchParams({ "view:/users": "page=3&status=active" }).toString()).views).toEqual({ "/users": "status=active" });
    expect(parsePrefs(new URLSearchParams({ "view:/users": `q=${"x".repeat(400)}` }).toString()).views).toEqual({});
  });
  it("savedView keeps filters, sort and page size, not the page or the search", () => {
    expect(savedView(new URLSearchParams("page=4&q=bima&role=Admin&sort=-createdAt&pageSize=50"), ["q"])).toBe("role=Admin&sort=-createdAt&pageSize=50");
    expect(savedView(new URLSearchParams("page=2&q=x"), ["q"])).toBe("");
  });
  it("viewHref reopens the saved view; the path itself never changes", () => {
    const prefs = { sidebar: "expanded" as const, density: "comfortable" as const, views: { "/users": "role=Admin" }, hidden: {} };
    expect(viewHref("/users", prefs)).toBe("/users?role=Admin");
    expect(viewHref("/roles", prefs)).toBe("/roles");
    expect(viewHref("/users", { ...prefs, views: { "/users": "a=%2F%2Fevil.com#x" } })).toBe("/users?a=%2F%2Fevil.com%23x");
  });
  it("hidden columns round-trip per list page; a bad key, an unknown page or more than 20 keys are dropped", () => {
    const c = prefsCookie({ ...DEFAULT_PREFS, hidden: { "/users": ["type", "createdAt"] } }, false);
    expect(parsePrefs(value(c)).hidden).toEqual({ "/users": ["type", "createdAt"] });
    expect(parsePrefs("cols:/users=type,../x,a b,createdAt&cols:/nope=type").hidden).toEqual({ "/users": ["type", "createdAt"] });
    expect(parsePrefs(`cols:/roles=${Array.from({ length: 30 }, (_, i) => `c${i}`).join(",")}`).hidden["/roles"]).toHaveLength(20);
  });
});
