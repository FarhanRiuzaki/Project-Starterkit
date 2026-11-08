"use client";
import { useState } from "react";
import { Panel, CountBadge } from "@starterkit/ui/ds";
import { Input } from "@starterkit/ui/ui/input";
import { formatNumber } from "@starterkit/ui/lib/format";
import { COMPONENT_INVENTORY } from "./component-inventory";
const groups = [{ id: "forms", label: "Forms and SaaS patterns" }, { id: "time", label: "Calendars and time" }, { id: "navigation", label: "Navigation and steps" }, { id: "data", label: "Data and feedback" }, { id: "tables", label: "Tables and charts" }, { id: "overlays", label: "Overlays" }, { id: "primitives", label: "Primitives" }, { id: "compositions", label: "Compositions" }, { id: "icons", label: "Icons" }, { id: "foundations", label: "Foundations" }];
/** Exact mapping of Figma family IDs to shared implementations and runnable examples. */
export function ComponentCatalog() {
  const [query, setQuery] = useState("");
  const matches = COMPONENT_INVENTORY.filter(item => `${item.name} ${item.api} ${item.source}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <Panel title="Component catalog" description="Find a Figma family, its shared API and a live example. Screen masters compose the same components; archived explorations are excluded." count={COMPONENT_INVENTORY.length}>
    <nav aria-label="Design system sections" className="mb-5 flex flex-wrap gap-2">{groups.map(group => <a key={group.id} href={`#ds-${group.id}`} className="rounded-md bg-tray px-3 py-2 text-body-sm text-fg-2 hover:text-fg">{group.label}</a>)}</nav>
    <label htmlFor="component-search" className="mb-2 block text-label">Find a component</label><Input id="component-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or shared API…" />
    <details open={query ? true : undefined} className="mt-4"><summary className="cursor-pointer rounded-md text-body-sm text-fg-2">Browse mapping <CountBadge>{formatNumber(matches.length)}</CountBadge></summary><div className="scroll-quiet mt-4 grid max-h-120 gap-2 overflow-y-auto" aria-label="Component mappings">{matches.length ? matches.map(item => <article key={item.id} className="flex flex-wrap items-center gap-3 rounded-md bg-tray p-3"><div className="min-w-0 flex-1"><h3 className="text-label">{item.name}</h3><p className="break-words text-caption text-fg-3">{item.api} · {item.kind}</p><code className="break-all font-mono text-caption text-fg-3">{item.source.startsWith("apps/") ? item.source : `@starterkit/ui/${item.source}`}</code></div><div className="flex gap-3 text-body-sm"><a className="underline underline-offset-4" href={`#ds-${item.section}`}>Example</a><a className="underline underline-offset-4" href={`https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=${item.id.replace(":", "-")}`} target="_blank" rel="noreferrer">Figma<span className="sr-only"> (new tab)</span></a></div></article>) : <p role="status" className="p-4 text-body-sm text-fg-3">No matching component. Try another name.</p>}</div></details>
  </Panel>;
}
