// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger, drawerLoader } from "./drawer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tree = (closeOn: string) => h("div", { id: "app" },
  h(Drawer, { closeOn },
    h(DrawerTrigger, { "aria-label": "Open navigation" }, "Menu"),
    h(DrawerContent, { title: "Navigation" },
      h(DrawerClose, { "aria-label": "Close navigation" }, "x"),
      h("a", { href: "/a" }, "Dashboard"),
      h("a", { href: "/b" }, "Users"))),
  h("main", null, h("button", { type: "button" }, "Behind")));

let root: Root | null = null;
let host: HTMLElement | null = null;
async function mount(closeOn = "/") {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(tree(closeOn)));
}
const rerender = (closeOn: string) => act(async () => root!.render(tree(closeOn)));
/** Lets Radix's deferred focus return (setTimeout 0) and the chunk's promise run. */
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const trigger = () => document.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const key = (k: string, el: Element = document.activeElement ?? document.body) =>
  act(async () => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
const open = async () => { await act(async () => trigger().click()); await flush(); };

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null; host = null;
  document.body.innerHTML = "";
});

describe("Drawer (navigation drawer, Radix Dialog through deferred-overlay)", () => {
  it("server markup: a closed dialog trigger, no content", () => {
    const html = renderToStaticMarkup(tree("/"));
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-slot="drawer-trigger"');
    expect(html).not.toContain("Dashboard");
  });

  it("a press on the stand-in before the chunk arrives opens it once loaded (controlled root)", async () => {
    expect(drawerLoader.get()).toBeNull();
    await mount();
    await act(async () => trigger().click());
    await act(async () => { await drawerLoader.load(); });
    await flush();
    expect(dialog()).not.toBeNull();
  });

  it("moves focus into the drawer and traps Tab inside it", async () => {
    await drawerLoader.load();
    await mount();
    await open();
    const d = dialog()!;
    expect(d.contains(document.activeElement)).toBe(true);
    const links = d.querySelectorAll("a");
    links[links.length - 1]!.focus();
    await key("Tab");
    expect(d.contains(document.activeElement), "Tab from the last item stays inside").toBe(true);
    await key("Tab", d.querySelector('[aria-label="Close navigation"]')!);
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it("makes the page behind inert while open, and only then", async () => {
    await drawerLoader.load();
    await mount();
    const app = document.getElementById("app")!.parentElement!;
    expect(app.hasAttribute("inert")).toBe(false);
    await open();
    expect(app.hasAttribute("inert"), "the page behind is inert").toBe(true);
    expect(dialog()!.closest("[inert]"), "the drawer itself is not").toBeNull();
    await key("Escape");
    await flush();
    expect(app.hasAttribute("inert")).toBe(false);
  });

  it("Escape closes it and focus returns to the menu button", async () => {
    await drawerLoader.load();
    await mount();
    await open();
    await key("Escape");
    await flush();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes when the route changes (closeOn) and focus returns to the menu button", async () => {
    await drawerLoader.load();
    await mount("/");
    await open();
    await rerender("/");
    expect(dialog(), "same route: stays open").not.toBeNull();
    await rerender("/users");
    await flush();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(document.querySelector("[inert]")).toBeNull();
  });
});
