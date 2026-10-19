#!/usr/bin/env node
// First-load JS budget per route, read from a finished `next build` (Turbopack does not print it).
// First load = rootMainFiles (build-manifest) ∪ every entry chunk of the route's segment tree
// (page_client-reference-manifest entryJSFiles: root layout, (main) layout, not-found, error, page).
// Size = gzip of each unique chunk. Lazy chunks (next/dynamic, import()) are not counted: they load on demand.
// Usage: node scripts/bundle-budget.mjs [--budget 250] [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const NEXT = path.join(ROOT, ".next");
const args = process.argv.slice(2);
const budgetKb = Number(args[args.indexOf("--budget") + 1] || process.env.BUNDLE_BUDGET_KB || 250);
const asJson = args.includes("--json");

const build = JSON.parse(readFileSync(path.join(NEXT, "build-manifest.json"), "utf8"));
const rootMain = build.rootMainFiles ?? [];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name === "page_client-reference-manifest.js") yield p;
  }
}

const gz = new Map();
const size = (file) => {
  if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(path.join(NEXT, file)), { level: 9 }).length);
  return gz.get(file);
};

const rows = [];
for (const file of walk(path.join(NEXT, "server", "app"))) {
  const sandbox = { self: {}, globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox);
  const manifest = sandbox.__RSC_MANIFEST ?? sandbox.self.__RSC_MANIFEST;
  for (const [entry, m] of Object.entries(manifest)) {
    const route = entry.replace(/\/page$/, "").replace(/\/\([^)]+\)/g, "") || "/";
    if (route.startsWith("/_")) continue; // _not-found, _global-error: framework fallbacks
    const files = new Set(rootMain);
    for (const list of Object.values(m.entryJSFiles ?? {})) for (const f of list) files.add(f);
    const bytes = [...files].reduce((a, f) => a + size(f), 0);
    rows.push({ route, kb: Math.round((bytes / 1024) * 10) / 10, chunks: files.size });
  }
}
rows.sort((a, b) => a.route.localeCompare(b.route));
const over = rows.filter((r) => r.kb > budgetKb);

if (asJson) console.log(JSON.stringify({ budgetKb, rows }, null, 1));
else {
  console.log(`First-load JS (gzip) per route — budget ${budgetKb} kB`);
  for (const r of rows) console.log(`${r.kb > budgetKb ? "OVER" : "ok  "}  ${r.route.padEnd(24)} ${String(r.kb).padStart(7)} kB  (${r.chunks} chunks)`);
}
if (rows.length === 0) { console.error("No client reference manifests found — run `next build` first."); process.exit(2); }
if (over.length) { console.error(`${over.length} route(s) over the ${budgetKb} kB budget.`); process.exit(1); }
