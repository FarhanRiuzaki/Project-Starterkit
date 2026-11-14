"use client";

import { useState } from "react";
import { AgentTeam } from "@starterkit/ui/affect/agent-team";
import { Button } from "@starterkit/ui/affect/button";
import { CoverFlow } from "@starterkit/ui/affect/cover-flow";
import { EmptyCalendar } from "@starterkit/ui/affect/empty-calendar";
import { EnrichmentOrbit } from "@starterkit/ui/affect/enrichment-orbit";
import { FrostCloud } from "@starterkit/ui/affect/frost-cloud";
import { GhostedChat } from "@starterkit/ui/affect/ghosted-chat";
import { GlowCloud } from "@starterkit/ui/affect/glow-cloud";
import { GridBackground } from "@starterkit/ui/affect/grid-background";
import { IntegrationBeam } from "@starterkit/ui/affect/integration-beam";
import { IntegrationGrid } from "@starterkit/ui/affect/integration-grid";
import { LayerStack } from "@starterkit/ui/affect/layer-stack";
import { LeadSourcing } from "@starterkit/ui/affect/lead-sourcing";
import { LogoCluster } from "@starterkit/ui/affect/logo-cluster";
import { LogoMarquee } from "@starterkit/ui/affect/logo-marquee";
import { ModelWheel } from "@starterkit/ui/affect/model-wheel";
import { NumberTicker } from "@starterkit/ui/affect/number-ticker";
import { RegionDach } from "@starterkit/ui/affect/region-dach";
import { ShimmerText, Skeleton } from "@starterkit/ui/affect/shimmer-loader";
import { SideFolder } from "@starterkit/ui/affect/side-folder";
import { TabOverload } from "@starterkit/ui/affect/tab-overload";
import { TeamInvite } from "@starterkit/ui/affect/team-invite";
import { TestimonialWall } from "@starterkit/ui/affect/testimonial-wall";
import type { AffectDemo } from "./types";

/** Fictional portrait: a soft tint and a head-and-shoulders silhouette, as a data URI (no remote images). */
const portrait = (n: number) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill-opacity="${0.08 * n + 0.08}"/><circle cx="32" cy="26" r="11" fill-opacity="0.55"/><path d="M10 64c0-14 10-22 22-22s22 8 22 22Z" fill-opacity="0.55"/></svg>`,
  );

/** Fictional mark: a simple shape on a 24 x 24 box. */
const SHAPES = [
  "M12 2 22 12 12 22 2 12Z",
  "M12 3 21 19H3Z",
  "M4 4h16v16H4Z",
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
  "M3 12a9 9 0 0 1 18 0v9H3Z",
  "M12 2 15 9l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z",
];
const COMPANIES = ["Northwind", "Harbor", "Lumen", "Tidewater", "Corvid", "Alder"];
const mark = (i: number) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={SHAPES[i % SHAPES.length] ?? ""} />
  </svg>
);

function AgentTeamDemo() {
  const m = (role: string, n: number) => ({ role, avatar: portrait(n) });
  return (
    <AgentTeam
      prompt="Build a team to triage the support queue"
      members={[m("Researcher", 1), m("Writer", 2), m("Reviewer", 3)]}
    />
  );
}

function CoverFlowDemo() {
  const items = ["Atlas", "Meridian", "Solstice", "Tundra", "Vesper"].map((title, i) => ({
    id: i,
    title,
    subtitle: `Volume ${i + 1}`,
    cover: <div className="grid h-full w-full place-items-center bg-bg-tray text-heading-lg text-fg-2">{title}</div>,
  }));
  // Its caption row has a minimum width: on a 360 px phone it scrolls inside the card, not the page.
  return <div className="scroll-quiet overflow-x-auto px-1"><CoverFlow items={items} itemWidth={180} itemHeight={180} /></div>;
}

function WheelDemo() {
  const models = COMPANIES.concat("Ember").map((name, i) => ({
    name,
    viewBox: "0 0 24 24",
    color: "currentColor",
    d: SHAPES[i % SHAPES.length] ?? "",
  }));
  return <ModelWheel models={models} />;
}

function GridDemo() {
  const logos = Array.from({ length: 22 }, (_, i) => ({
    name: `${COMPANIES[i % COMPANIES.length]} ${i + 1}`,
    path: SHAPES[i % SHAPES.length] ?? "",
  }));
  return <IntegrationGrid logos={logos} columns={7} />;
}

function BeamDemo() {
  const tool = (name: string, i: number) => ({ name, logo: mark(i) });
  return (
    <IntegrationBeam
      left={[tool("Northwind", 0), tool("Harbor", 1), tool("Lumen", 2)]}
      right={[tool("Tidewater", 3), tool("Corvid", 4), tool("Alder", 5)]}
      center={{ name: "Starter kit" }}
    />
  );
}

function LayerStackDemo() {
  return (
    <LayerStack
      items={[
        { title: "Sync records", hint: "2 min ago", icon: "bolt" },
        { title: "Warehouse", hint: "Connected", icon: "database" },
        { title: "Webhooks", hint: "12 active", icon: "plug" },
        { title: "Enrichment", hint: "Queued", icon: "spark" },
        { title: "Health checks", hint: "All clear", icon: "pulse" },
      ]}
    />
  );
}

function RegionDemo() {
  return <RegionDach showSwitcher />;
}

function InviteDemo() {
  return (
    <TeamInvite
      avatars={[
        { src: portrait(1), name: "Maya" },
        { src: portrait(2), name: "Jon" },
        { src: portrait(3), name: "Sam" },
      ]}
    />
  );
}

function GridBackgroundDemo() {
  const [dir, setDir] = useState<"up" | "diagonal">("diagonal");
  return (
    <GridBackground direction={dir} reveal className="h-48 w-full">
      <div className="grid h-48 place-items-center gap-2 text-center">
        <p className="text-body-sm text-fg-2">Drifting grid, {dir}</p>
        <Button size="sm" variant="secondary" onClick={() => setDir(dir === "up" ? "diagonal" : "up")}>
          Change direction
        </Button>
      </div>
    </GridBackground>
  );
}

function NumberTickerDemo() {
  const [value, setValue] = useState(12840);
  return (
    <div className="grid gap-3">
      <NumberTicker value={value} className="text-display text-fg-1" />
      <div>
        <Button size="sm" variant="secondary" onClick={() => setValue((v) => (v === 12840 ? 98215 : 12840))}>
          Change value
        </Button>
      </div>
    </div>
  );
}

function ShimmerDemo() {
  return (
    <div className="grid gap-3">
      <ShimmerText>Generating your report</ShimmerText>
      <div className="flex items-center gap-3">
        <Skeleton circle width={40} />
        <div className="grid flex-1 gap-2">
          <Skeleton width="60%" />
          <Skeleton height={10} />
        </div>
      </div>
    </div>
  );
}

function MarqueeDemo() {
  const logos = COMPANIES.map((name, i) => ({ name, svg: mark(i) }));
  return <LogoMarquee logos={logos} rows={2} labels="beside" label="Customer logos" />;
}

function TestimonialDemo() {
  const items = [
    { quote: "We closed the books two days faster.", name: "Maya Lindqvist", role: "Finance lead", company: "Northwind" },
    {
      quote: "Roles and permissions finally match how our teams work, and the activity log answers audit questions in minutes.",
      name: "Jon Okafor",
      role: "Operations",
      company: "Harbor",
      rating: 5,
      verified: true,
    },
    { quote: "Setup took an afternoon.", name: "Sam Reyes", role: "Engineer", company: "Lumen", rating: 4 },
    { quote: "Support answered every question the same day.", name: "Ida Berg", role: "Product manager", company: "Tidewater" },
    { quote: "The saved views alone paid for the switch.", name: "Luca Rossi", role: "Analyst", company: "Corvid", verified: true },
    { quote: "Clear, quick and quiet.", name: "Noor Haddad", role: "Designer", company: "Alder", rating: 5 },
  ];
  return <TestimonialWall items={items} columns={3} />;
}

export const DEMOS: readonly AffectDemo[] = [
  { slug: "agent-team", name: "Agent Team", Demo: AgentTeamDemo },
  { slug: "cover-flow", name: "Cover Flow", Demo: CoverFlowDemo },
  { slug: "empty-calendar", name: "Empty Calendar", Demo: EmptyCalendar },
  { slug: "enrichment-orbit", name: "Enrichment Orbit", Demo: EnrichmentOrbit },
  { slug: "frost-cloud", name: "Frost Cloud", Demo: FrostCloud },
  { slug: "ghosted-chat", name: "Ghosted Chat", Demo: GhostedChat },
  { slug: "glow-cloud", name: "Glow Cloud", Demo: GlowCloud },
  { slug: "integration-beam", name: "Integration Beam", Demo: BeamDemo, wide: true },
  { slug: "integration-grid", name: "Integration Grid", Demo: GridDemo, wide: true },
  { slug: "layer-stack", name: "Layer Stack", Demo: LayerStackDemo },
  { slug: "lead-sourcing", name: "Lead Sourcing", Demo: LeadSourcing },
  { slug: "logo-cluster", name: "Logo Cluster", Demo: LogoCluster },
  { slug: "model-wheel", name: "Model Wheel", Demo: WheelDemo },
  { slug: "region-dach", name: "Region DACH", Demo: RegionDemo },
  { slug: "side-folder", name: "Side Folder", Demo: SideFolder },
  { slug: "tab-overload", name: "Tab Overload", Demo: TabOverload },
  { slug: "team-invite", name: "Team Invite", Demo: InviteDemo },
  { slug: "grid-background", name: "Grid Background", Demo: GridBackgroundDemo },
  { slug: "number-ticker", name: "Number Ticker", Demo: NumberTickerDemo },
  { slug: "shimmer-loader", name: "Shimmer Loader", Demo: ShimmerDemo },
  { slug: "logo-marquee", name: "Logo Marquee", Demo: MarqueeDemo, wide: true },
  { slug: "testimonial-wall", name: "Testimonial Wall", Demo: TestimonialDemo, wide: true },
];
