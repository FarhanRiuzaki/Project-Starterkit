"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Column, CountBadge, DataTable, Panel, Segmented, StatusChip } from "@starterkit/ui/ds";
import { cn } from "@starterkit/ui/lib/cn";
import { formatNumber } from "@starterkit/ui/lib/format";
import { HEALTH } from "@starterkit/ui/lib/status";
import { CHART_STAGGER, cssEase, DUR, EASE, LOADING, NumberTween, OVERLAY_MOTION, Reveal, SPRING_FLIP, SPRING_INDICATOR, SPRING_SOFT, Stagger, STAGGER, StaggerItem, tweenDuration } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@starterkit/ui/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, menuLoader } from "@starterkit/ui/ui/dropdown-menu";
import { Icon } from "@starterkit/ui/ui/icon";
import { CheckIcon, RefreshIcon, SessionsIcon } from "@starterkit/ui/ui/icons";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { useScrollsX } from "@starterkit/ui/ui/table";
import { toast } from "@starterkit/ui/ui/toast";

type Spring = { stiffness: number; damping: number; mass: number };
export const fmtMs = (s: number) => `${Math.round(s * 1000)} ms`;
export const fmtEase = cssEase;
/** "180 ms in · 100 ms out" from an OVERLAY_MOTION entry: the tokens the component classes use. */
export const inOut = (m: { open: keyof typeof DUR; close: keyof typeof DUR }) => `${fmtMs(DUR[m.open])} in · ${fmtMs(DUR[m.close])} out`;
export const fmtSpring = (s: Spring) => `stiffness ${s.stiffness} · damping ${s.damping} · mass ${s.mass}`;

/** Pause between a close animation ending and the demo reopening, so the replay reads as two steps. */
const REOPEN_GAP_MS = DUR.instant * 1000;

const REDUCED_FADE = `Fade only, ${fmtMs(DUR.instant)}`;
const REDUCED_INSTANT = "Instant swap";

type Pattern = { id: string; name: string; layer: "CSS" | "Motion"; duration: string; reduced: string; use: string };
/** One row per pattern: the replay demos and the rules table are both derived from this list. */
export const PATTERNS: readonly Pattern[] = [
  { id: "page-enter", name: "page enter", layer: "CSS", duration: fmtMs(DUR.page), reduced: REDUCED_FADE, use: "Route change; the shell never animates" },
  { id: "stagger", name: "stagger", layer: "CSS", duration: `${fmtMs(DUR.enter)} · ${fmtMs(STAGGER.step)} steps`, reduced: `${REDUCED_FADE}, no delay`, use: `KPI trays and card grids of ${STAGGER.max} items or fewer` },
  { id: "reveal", name: "reveal", layer: "CSS", duration: `${fmtMs(DUR.enter)} in · ${fmtMs(DUR.fast)} out`, reduced: REDUCED_FADE, use: "Skeleton to content, in the same box" },
  { id: "dialog", name: "dialog", layer: "CSS", duration: `${inOut(OVERLAY_MOTION.dialog)}; scrim ${inOut(OVERLAY_MOTION.scrim)}`, reduced: `${REDUCED_FADE}, no scale`, use: "Confirmations and one-time secrets" },
  { id: "menu", name: "menu", layer: "CSS", duration: inOut(OVERLAY_MOTION.menu), reduced: `${REDUCED_FADE}, no slide`, use: "Action menus and popovers" },
  { id: "toast", name: "toast", layer: "CSS", duration: "Sonner's own (400 ms slide and fade, not a token)", reduced: "No animation (sonner's own rule)", use: "Result of an action" },
  { id: "badge-pop", name: "badge pop", layer: "CSS", duration: fmtMs(DUR.pop), reduced: REDUCED_FADE, use: "A count or tone that changed" },
  { id: "chip-change", name: "chip change", layer: "CSS", duration: fmtMs(DUR.fast), reduced: REDUCED_INSTANT, use: "A status chip whose value changed" },
  { id: "new-row", name: "new row", layer: "CSS", duration: fmtMs(DUR.flash), reduced: "None", use: "Rows that arrive after the first load; never on load or filter change" },
  { id: "number-tween", name: "number tween", layer: "Motion", duration: `${fmtMs(tweenDuration(0, 1e-9, 1))} to ${fmtMs(DUR.tween)}`, reduced: REDUCED_INSTANT, use: "KPI values when new data arrives" },
  { id: "indicator", name: "indicator", layer: "Motion", duration: `SPRING_INDICATOR; CSS fallback ${fmtMs(DUR.slow)}`, reduced: "Jumps, fades only", use: "Segmented thumb and tab underline" },
  { id: "sidebar-width", name: "sidebar width", layer: "CSS", duration: fmtMs(DUR.slow), reduced: "Instant", use: "Collapse and expand; the only width animation" },
  { id: "copy-check", name: "copy check", layer: "CSS", duration: fmtMs(DUR.fast), reduced: REDUCED_FADE, use: "Copy button confirmation" },
  { id: "disclosure", name: "disclosure", layer: "CSS", duration: fmtMs(DUR.enter), reduced: `Opacity only, ${fmtMs(DUR.instant)}`, use: "Native details: height and opacity, where the browser supports it" },
];

/** Rules-only rows: patterns that have no replay demo here (they live on real surfaces), so the table is the full inventory. */
export const RULES_ONLY: readonly Pattern[] = [
  { id: "tooltip", name: "tooltip", layer: "CSS", duration: inOut(OVERLAY_MOTION.tooltip), reduced: REDUCED_FADE, use: "Labels of icon buttons and blocked actions; opens after 300 ms" },
  { id: "drawer", name: "drawer and bottom sheet", layer: "CSS", duration: `${inOut(OVERLAY_MOTION.drawer)}; scrim ${inOut(OVERLAY_MOTION.scrim)}`, reduced: `${REDUCED_FADE}, no slide`, use: "Phone navigation drawer from the left; below 768 px a dialog rises from the bottom as a sheet (dialog tokens)" },
  { id: "tab-reveal", name: "tab and sign-in step reveal", layer: "CSS", duration: fmtMs(DUR.enter), reduced: REDUCED_FADE, use: "A tab panel or a sign-in step appearing; the reveal, not a slide" },
  { id: "card-lift", name: "card lift", layer: "CSS", duration: fmtMs(DUR.fast), reduced: "No lift", use: "Hover and press on clickable cards" },
  { id: "page-swap", name: "page exit", layer: "Motion", duration: `${fmtMs(DUR.exit)} out · ${fmtMs(DUR.page)} in`, reduced: REDUCED_FADE, use: "Route change once the deferred layer has loaded; the old page fades out without moving" },
  { id: "card-reorder", name: "card reorder", layer: "Motion", duration: "SPRING_FLIP", reduced: "Jumps", use: "Card grids re-sorted or filtered, up to 60 cards; never table rows" },
  { id: "loading", name: "loading state", layer: "CSS", duration: `shows after ${fmtMs(LOADING.delay)}, stays at least ${fmtMs(LOADING.minVisible)}`, reduced: "Same timing", use: "Skeletons, busy dims and route loading shapes (useDelayedFlag): a fast load shows none, a slow one never blinks" },
  { id: "skeleton-shimmer", name: "skeleton shimmer", layer: "CSS", duration: `${fmtMs(DUR.flash)} loop`, reduced: "No sweep", use: "Placeholders while data loads; hands over with the reveal" },
  { id: "chart", name: "chart grow and line draw", layer: "CSS", duration: `${fmtMs(DUR.slow)} grow, ${fmtMs(CHART_STAGGER.step)} per bar up to ${fmtMs(CHART_STAGGER.max)} · ${fmtMs(DUR.draw)} draw`, reduced: REDUCED_FADE, use: "Plays once per chart; data-settled turns it off after, so a refresh re-renders without replaying" },
];
export const RULES: readonly Pattern[] = [...PATTERNS, ...RULES_ONLY];

function Demo({ id, run, onReplay, children }: { id: string; run: number; onReplay: () => void; children: ReactNode }) {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown motion pattern ${id}`);
  return (
    <li data-demo={id} data-run={run} className="grid content-start gap-3 rounded-lg border border-line bg-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-title-3 text-fg capitalize">{p.name}</h3>
        <Button size="sm" variant="secondary" onClick={onReplay}><Icon icon={RefreshIcon} />Replay {p.name}</Button>
      </div>
      <div className="grid min-h-24 content-center gap-2 overflow-hidden rounded-md border border-line bg-card p-3">{children}</div>
    </li>
  );
}

/** A run counter per demo; replaying bumps it, and demos key their stage by it so CSS enters remount and replay. */
/** A reopen timer that is cleared when replaced and on unmount. */
function useTimer() {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (ref.current) clearTimeout(ref.current); }, []);
  return {
    set: (fn: () => void, ms: number) => { if (ref.current) clearTimeout(ref.current); ref.current = setTimeout(fn, ms); },
    clear: () => { if (ref.current) clearTimeout(ref.current); ref.current = null; },
  };
}

function useRun() {
  const [run, setRun] = useState(0);
  return [run, () => setRun((r) => r + 1)] as const;
}

const SAMPLE = <span className="text-body-sm text-fg-2">Alex Rivers signed in from Chrome on macOS</span>;

function PageEnterDemo() {
  const [run, replay] = useRun();
  return <Demo id="page-enter" run={run} onReplay={replay}><div key={run} className="animate-page-enter">{SAMPLE}</div></Demo>;
}

function StaggerDemo() {
  const [run, replay] = useRun();
  return (
    <Demo id="stagger" run={run} onReplay={replay}>
      <Stagger key={run} className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => <StaggerItem key={i} index={i - 1} className="rounded-md border border-line bg-tray px-2 py-3 text-center text-label text-fg-2">Tile {i}</StaggerItem>)}
      </Stagger>
    </Demo>
  );
}

function RevealStage() {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), DUR.tween * 1000); return () => clearTimeout(t); }, []);
  return (
    <Reveal loading={loading} skeleton={<div className="grid gap-2"><Skeleton className="h-2.5 w-1/3" /><Skeleton className="h-2.5 w-2/3" /></div>}>
      <div className="grid gap-1"><span className="text-label text-fg-3">Active sessions now</span><span className="text-stat-sm text-fg">3</span></div>
    </Reveal>
  );
}
function RevealDemo() {
  const [run, replay] = useRun();
  return <Demo id="reveal" run={run} onReplay={replay}><RevealStage key={run} /></Demo>;
}

function DialogDemo() {
  const [run, replay] = useRun();
  const [open, setOpen] = useState(false);
  return (
    <Demo id="dialog" run={run} onReplay={() => { replay(); setOpen(true); }}>
      <span className="text-body-sm text-fg-3">Opens a real dialog with sample copy.</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sample dialog</DialogTitle>
            <DialogDescription>Closing it changes nothing. It shows how a dialog enters and leaves.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </Demo>
  );
}

function MenuDemo() {
  const [run, replay] = useRun();
  const [open, setOpen] = useState(false);
  const timer = useTimer();
  function again() {
    replay();
    setOpen(false);
    // The menu implementation is a deferred chunk: make sure it is loaded before opening.
    void menuLoader.load().then(() => timer.set(() => setOpen(true), DUR.exit * 1000 + REOPEN_GAP_MS));
  }
  return (
    <Demo id="menu" run={run} onReplay={again}>
      <DropdownMenu open={open} onOpenChange={(o) => { timer.clear(); setOpen(o); }} modal={false}>
        <DropdownMenuTrigger asChild><Button size="sm" variant="secondary" className="w-fit">Sample menu</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>Refresh now</DropdownMenuItem>
          <DropdownMenuItem>Copy link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Demo>
  );
}

function ToastDemo() {
  const [run, replay] = useRun();
  function fire() {
    replay();
    toast.success("Sample notification", { description: "This is how a result toast enters and leaves." });
  }
  return <Demo id="toast" run={run} onReplay={fire}><span className="text-body-sm text-fg-3">Shows a sample toast at the bottom right.</span></Demo>;
}

function BadgePopDemo() {
  const [run, replay] = useRun();
  return (
    <Demo id="badge-pop" run={run} onReplay={replay}>
      <span className="inline-flex items-center gap-2 text-body-sm text-fg-2">Active sessions <span key={run} className={cn(run > 0 && "animate-pop")}><CountBadge>{2 + run}</CountBadge></span></span>
    </Demo>
  );
}

const CHIP_VALUES = ["healthy", "degraded", "down"] as const;
function ChipChangeDemo() {
  const [run, replay] = useRun();
  const v = CHIP_VALUES[run % CHIP_VALUES.length] ?? "healthy";
  return <Demo id="chip-change" run={run} onReplay={replay}><span><StatusChip health={v} label={HEALTH[v].label} description={HEALTH[v].description} /></span></Demo>;
}

type DemoRow = { id: string; name: string };
const ROW_COLUMNS: Column<DemoRow>[] = [
  { key: "name", header: "User", cell: (r) => r.name },
  { key: "id", header: "Session", cell: (r) => <span className="font-mono text-mono">{r.id}</span> },
];
const ROW_NAMES = ["Alex Rivers", "Sam Hale", "Robin Lund", "Jamie Okafor", "Taylor Stone", "Morgan Quill", "Casey Park", "Riley Shaw"];
function NewRowDemo() {
  const [run, replay] = useRun();
  const rows: DemoRow[] = Array.from({ length: 2 + run }, (_, i) => ({ id: `s-${4100 + (1 + run - i)}`, name: ROW_NAMES[(1 + run - i) % ROW_NAMES.length] ?? "User" }));
  return (
    <Demo id="new-row" run={run} onReplay={replay}>
      <div className="max-h-40 overflow-hidden -m-3"><DataTable label="Sample rows" highlightNew columns={ROW_COLUMNS} rows={rows.slice(0, 3)} rowKey={(r) => r.id} empty={{ icon: SessionsIcon, title: "No rows", description: "Replay adds a row." }} /></div>
    </Demo>
  );
}

function NumberTweenDemo() {
  const [run, replay] = useRun();
  return <Demo id="number-tween" run={run} onReplay={replay}><NumberTween className="text-stat text-fg" value={1284 + run * 96} format={formatNumber} /></Demo>;
}

const SEGMENTS = [{ value: "hour", label: "1 hour" }, { value: "day", label: "24 hours" }, { value: "week", label: "7 days" }] as const;
function IndicatorDemo() {
  const [run, replay] = useRun();
  const value = SEGMENTS[run % SEGMENTS.length]?.value ?? "hour";
  return <Demo id="indicator" run={run} onReplay={replay}><Segmented label="Sample range" value={value} onChange={() => undefined} options={SEGMENTS} /></Demo>;
}

/** A scaled mock rail (64 → 160 px), not the real sidebar. */
function SidebarWidthDemo() {
  const [run, replay] = useRun();
  const wide = run % 2 === 1;
  return (
    <Demo id="sidebar-width" run={run} onReplay={replay}>
      <div className={cn("transition-sidebar grid h-16 content-center gap-1.5 overflow-hidden rounded-md border border-line bg-tray px-2", wide ? "w-40" : "w-14")} data-wide={wide}>
        {["Users", "Roles", "Activity"].map((l) => <span key={l} className="flex items-center gap-2"><span className="size-3 shrink-0 rounded-xs bg-fg-3" /><span className="truncate text-caption text-fg-2">{l}</span></span>)}
      </div>
    </Demo>
  );
}

function CopyCheckDemo() {
  const [run, replay] = useRun();
  return (
    <Demo id="copy-check" run={run} onReplay={replay}>
      <span className="inline-flex items-center gap-2 font-mono text-mono text-fg">u-0042<Icon key={run} icon={CheckIcon} className="size-3.5 text-healthy-ink animate-swap" /></span>
    </Demo>
  );
}

function DisclosureDemo() {
  const [run, replay] = useRun();
  const [open, setOpen] = useState(true);
  const timer = useTimer();
  function again() {
    replay();
    setOpen(false);
    timer.set(() => setOpen(true), DUR.slow * 1000 + REOPEN_GAP_MS);
  }
  return (
    <Demo id="disclosure" run={run} onReplay={again}>
      <details open={open} onToggle={(e) => { timer.clear(); setOpen(e.currentTarget.open); }} className="text-body-sm">
        <summary className="cursor-pointer text-fg">What happens when a session ends?</summary>
        <p className="pt-2 text-fg-3">That device is signed out. Other sessions of the same user stay signed in.</p>
      </details>
    </Demo>
  );
}

function TokenRows({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid">
      {rows.map(([k, v]) => (
        <div key={k} data-token={k} className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-body-sm last:border-b-0">
          <dt className="font-mono text-caption text-fg-3">{k}</dt><dd className="text-fg-2 tabular">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The /ds Motion section: tokens rendered from code, replayable patterns, the rules, and a reduced-motion preview. */
export function MotionSection() {
  const [rulesBox, rulesScroll] = useScrollsX<HTMLDivElement>();
  const [preview, setPreview] = useState<"off" | "reduced">("off");
  return (
    <section data-motion-section="" data-motion-preview={preview === "reduced" ? "reduced" : undefined} aria-labelledby="motion-title" className="grid gap-section">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 id="motion-title" className="text-title-3 text-fg-2">Motion</h2>
        <div className="grid justify-items-end gap-1.5">
          <div className="flex items-center gap-2 text-body-sm text-fg-3">
            Preview reduced motion
            <Segmented label="Preview reduced motion" value={preview} onChange={setPreview} options={[{ value: "off", label: "Off" }, { value: "reduced", label: "Reduced" }]} />
          </div>
          <p className="max-w-xl text-right text-caption text-fg-3">
            Applies to the inline demos. Dialog, menu and toast render outside this section and follow your system setting; count-ups and page transitions read the system setting too. The Reduced motion column below is the rule.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-gutter">
        <Panel title="Tokens" description="Rendered from the constants in code" className="col-span-12" bodyClassName="grid grid-cols-3 gap-6 max-md:grid-cols-1">
          <div className="grid content-start gap-1"><h3 className="eyebrow text-fg-3">Durations</h3><TokenRows rows={Object.entries(DUR).map(([k, v]) => [`--dur-${k}`, fmtMs(v)] as const)} /></div>
          <div className="grid content-start gap-1"><h3 className="eyebrow text-fg-3">Easings</h3><TokenRows rows={Object.entries(EASE).map(([k, v]) => [`--ease-${k}`, fmtEase(v)] as const)} /></div>
          <div className="grid content-start gap-1"><h3 className="eyebrow text-fg-3">Springs</h3>
            <TokenRows rows={[["SPRING_INDICATOR", fmtSpring(SPRING_INDICATOR)], ["SPRING_SOFT", fmtSpring(SPRING_SOFT)], ["SPRING_FLIP", fmtSpring(SPRING_FLIP)]]} />
          </div>
        </Panel>
        <Panel title="Patterns" description="Replay re-runs the pattern" className="col-span-12">
          <ul aria-label="Motion patterns" className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <PageEnterDemo /><StaggerDemo /><RevealDemo /><DialogDemo /><MenuDemo /><ToastDemo /><BadgePopDemo /><ChipChangeDemo />
            <NewRowDemo /><NumberTweenDemo /><IndicatorDemo /><SidebarWidthDemo /><CopyCheckDemo /><DisclosureDemo />
          </ul>
        </Panel>
        <Panel title="When to use which" description="Transform and opacity only; native details animate height" className="col-span-12" flush>
          {/* Scrolls inside the card below 768 px until the stacked layout (Task 20). */}
          <div ref={rulesBox} className="scroll-quiet overflow-x-auto" {...(rulesScroll ? { tabIndex: 0, role: "region", "aria-label": "Motion rules" } : {})}><table aria-label="Motion rules" className="w-full text-body-sm">
            <thead>
              <tr className="text-left text-label text-fg-3">
                <th scope="col" className="px-4 py-2 font-medium">Pattern</th><th scope="col" className="px-4 py-2 font-medium">Layer</th>
                <th scope="col" className="px-4 py-2 font-medium">Duration</th><th scope="col" className="px-4 py-2 font-medium">Reduced motion</th>
                <th scope="col" className="px-4 py-2 font-medium">Use for</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((p) => (
                <tr key={p.id} data-pattern={p.id} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-medium text-fg capitalize">{p.name}</th>
                  <td className="px-4 py-2 text-fg-2">{p.layer}</td><td className="px-4 py-2 text-fg-2 tabular">{p.duration}</td>
                  <td className="px-4 py-2 text-fg-2">{p.reduced}</td><td className="px-4 py-2 text-fg-3">{p.use}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Panel>
      </div>
    </section>
  );
}
