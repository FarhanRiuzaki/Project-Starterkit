"use client";

import { useRef, useState } from "react";
import { Breadcrumb } from "@starterkit/ui/affect/breadcrumb";
import { Button } from "@starterkit/ui/affect/button";
import { ContextMenu } from "@starterkit/ui/affect/context-menu";
import { DropdownMenu } from "@starterkit/ui/affect/dropdown-menu";
import { IconButton } from "@starterkit/ui/affect/icon-button";
import { Pagination } from "@starterkit/ui/affect/pagination";
import { Popover } from "@starterkit/ui/affect/popover";
import { ProfileMenu } from "@starterkit/ui/affect/profile-menu";
import { ReactionBar } from "@starterkit/ui/affect/reaction-bar";
import { SegmentedControl } from "@starterkit/ui/affect/segmented-control";
import { ToggleGroup } from "@starterkit/ui/affect/toggle-group";
import type { AffectDemo } from "./types";

const LOADING_MS = 1800;
const TOTAL_ROWS = 1284;

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const PLUS = <Glyph d="M8 3v10M3 8h10" />;
const HEART = <Glyph d="M8 13.5S2.5 10 2.5 6a3 3 0 0 1 5.5-1.6A3 3 0 0 1 13.5 6c0 4-5.5 7.5-5.5 7.5Z" />;
const STAR = <Glyph d="m8 2 1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.2 4.3 13.3l.8-4.1L2 6.3l4.2-.5L8 2Z" />;
const BELL = <Glyph d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11ZM6.5 14h3" />;
const LIST = <Glyph d="M3 4h10M3 8h10M3 12h10" />;
const GRID = <Glyph d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z" />;

function ButtonDemo() {
  const [loading, setLoading] = useState(false);
  const run = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), LOADING_MS);
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary">Save changes</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="destructive">Delete project</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={PLUS}>Small</Button>
        <Button size="md" iconRight={PLUS}>Medium</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button loading={loading} onClick={run}>{loading ? "Publishing" : "Publish report"}</Button>
        <span className="text-label text-fg-3">Press to play the loading shimmer</span>
      </div>
    </div>
  );
}

function IconButtonDemo() {
  const [starred, setStarred] = useState(false);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton icon={PLUS} label="Add item" variant="ghost" />
        <IconButton icon={BELL} label="Notifications" variant="secondary" />
        <IconButton icon={HEART} label="Save" variant="primary" />
        <IconButton icon={PLUS} label="Add item, small" size="sm" variant="secondary" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <IconButton icon={STAR} label="Star" variant="secondary" pressed={starred} onClick={() => setStarred((s) => !s)} />
        <span className="text-label text-fg-3">{starred ? "Starred" : "Not starred"} (toggle with pressed)</span>
      </div>
    </div>
  );
}

function ReactionBarDemo() {
  const [last, setLast] = useState("No reaction yet");
  return (
    <div className="grid gap-3">
      <ReactionBar
        reactions={{ like: { count: 42, active: true }, comment: { count: 8 }, repost: { count: 3 }, share: { count: 1 } }}
        onReact={(key, s) => setLast(`${key}: ${s.active ? "on" : "off"}, ${s.count}`)}
      />
      <ReactionBar actions={["like", "share"]} reactions={{ like: { count: 120 } }} />
      <p className="text-label text-fg-3">{last}</p>
    </div>
  );
}

function ToggleGroupDemo() {
  const [view, setView] = useState<string | null>("list");
  const [marks, setMarks] = useState<string[]>(["bold"]);
  return (
    <div className="grid gap-3">
      <ToggleGroup
        type="single"
        variant="tray"
        aria-label="View"
        value={view}
        onChange={setView}
        items={[
          { value: "list", icon: LIST, ariaLabel: "List view" },
          { value: "grid", icon: GRID, ariaLabel: "Grid view" },
        ]}
      />
      <ToggleGroup
        variant="buttons"
        aria-label="Text style"
        value={marks}
        onChange={setMarks}
        items={[
          { value: "bold", label: "Bold" },
          { value: "italic", label: "Italic" },
          { value: "underline", label: "Underline" },
          { value: "strike", label: "Strikethrough", disabled: true },
        ]}
      />
      <p className="text-label text-fg-3">View: {view ?? "none"}. Styles: {marks.join(", ") || "none"}</p>
    </div>
  );
}

function BreadcrumbDemo() {
  const [path, setPath] = useState("");
  const pick = (name: string) => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setPath(name);
  };
  return (
    <div className="grid gap-3">
      <Breadcrumb
        items={[
          { label: "Home", href: "#home", onClick: pick("Home") },
          { label: "Projects", href: "#projects", onClick: pick("Projects") },
          { label: "Harbor redesign", href: "#harbor", onClick: pick("Harbor redesign") },
          { label: "Assets" },
        ]}
      />
      <Breadcrumb
        separator="slash"
        maxItems={3}
        items={[
          { label: "Home", href: "#home", onClick: pick("Home") },
          { label: "Teams", href: "#teams", onClick: pick("Teams") },
          { label: "Design", href: "#design", onClick: pick("Design") },
          { label: "Library", href: "#library", onClick: pick("Library") },
          { label: "Icons" },
        ]}
      />
      <p className="text-label text-fg-3">{path ? `Opened ${path}` : "The second trail folds its middle into an ellipsis"}</p>
    </div>
  );
}

function ContextMenuDemo() {
  const [log, setLog] = useState("Right-click or long-press the card");
  const [pinned, setPinned] = useState(false);
  const say = (s: string) => () => setLog(s);
  return (
    <div className="grid gap-3">
      <ContextMenu
        title="Invoice 2041"
        items={[
          { label: "Open", shortcut: "Enter", onSelect: say("Open") },
          { label: "Duplicate", shortcut: "⌘D", onSelect: say("Duplicate") },
          { label: "Pin to top", checked: pinned, type: "checkbox", keepOpen: true, onSelect: () => setPinned((p) => !p) },
          {
            label: "Move to",
            submenu: [
              { label: "Q3 archive", onSelect: say("Moved to Q3 archive") },
              { label: "Q4 drafts", onSelect: say("Moved to Q4 drafts") },
            ],
          },
          { label: "Delete", danger: true, divider: true, onSelect: say("Delete") },
        ]}
      >
        <div className="rounded-lg bg-card p-4 text-body-sm text-fg-2">Invoice 2041, Marlow Studio, due 30 Nov</div>
      </ContextMenu>
      <p className="text-label text-fg-3">{log}{pinned ? ", pinned" : ""}</p>
    </div>
  );
}

function DropdownMenuDemo() {
  const [sort, setSort] = useState("name");
  const [log, setLog] = useState("Nothing picked");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu
        title="Actions"
        trigger={({ open, toggle, triggerProps }) => (
          <Button variant="secondary" aria-pressed={open} {...triggerProps} onClick={() => toggle()}>
            Actions
          </Button>
        )}
        items={[
          { label: "Rename", description: "Change the file name", shortcut: "F2", onSelect: () => setLog("Rename") },
          { label: "Share", onSelect: () => setLog("Share") },
          { label: "Sort by name", type: "radio", checked: sort === "name", divider: true, keepOpen: true, onSelect: () => setSort("name") },
          { label: "Sort by date", type: "radio", checked: sort === "date", keepOpen: true, onSelect: () => setSort("date") },
          { label: "Export", disabled: true },
          { label: "Delete", danger: true, divider: true, onSelect: () => setLog("Delete") },
        ]}
      />
      <span className="text-label text-fg-3">{log}, sorted by {sort}</span>
    </div>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(3);
  const [size, setSize] = useState(20);
  const [short, setShort] = useState(1);
  return (
    <div className="grid gap-4">
      <Pagination
        page={page}
        onPageChange={setPage}
        total={TOTAL_ROWS}
        pageSize={size}
        pageSizes={[10, 20, 50]}
        onPageSizeChange={setSize}
      />
      <Pagination compact page={short} onPageChange={setShort} total={TOTAL_ROWS} pageSize={20} />
      <Pagination page={2} onPageChange={() => {}} pageCount={8} disabled />
    </div>
  );
}

function PopoverDemo() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchor} className="relative inline-block">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)}>Share link</Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        title="Share this board"
        description="Anyone with the link can view."
        align="start"
      >
        <div className="grid gap-2 text-body-sm text-fg-2">
          <p>Link expires in 7 days.</p>
          <Button size="sm" onClick={() => setOpen(false)}>Copy link</Button>
        </div>
      </Popover>
    </div>
  );
}

function ProfileMenuDemo() {
  const [log, setLog] = useState("Open the menu");
  return (
    <div className="grid gap-3">
      <ProfileMenu
        name="Maya Orlov"
        email="maya@example.com"
        items={[
          { id: "profile", label: "Profile", onSelect: () => setLog("Profile") },
          { id: "billing", label: "Billing", badge: "New", onSelect: () => setLog("Billing") },
          { id: "out", label: "Sign out", onSelect: () => setLog("Sign out") },
        ]}
        setup={{ done: 3, total: 5, next: "Add a profile photo", onContinue: () => setLog("Continue setup") }}
      />
      <p className="text-label text-fg-3">{log}</p>
    </div>
  );
}

function SegmentedControlDemo() {
  const [range, setRange] = useState("week");
  const [tab, setTab] = useState("overview");
  return (
    <div className="grid gap-4">
      <SegmentedControl
        value={range}
        onChange={setRange}
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week", count: 12 },
          { value: "month", label: "Month", badge: "Save 20%" },
          { value: "year", label: "Year", disabled: true },
        ]}
      />
      <SegmentedControl
        variant="underline"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "members", label: "Members" },
          { value: "billing", label: "Billing" },
        ]}
      />
      <p className="text-label text-fg-3">Range: {range}. Tab: {tab}</p>
    </div>
  );
}

export const DEMOS: readonly AffectDemo[] = [
  { slug: "button", name: "Button", Demo: ButtonDemo },
  { slug: "icon-button", name: "Icon Button", Demo: IconButtonDemo },
  { slug: "reaction-bar", name: "Reaction Bar", Demo: ReactionBarDemo },
  { slug: "toggle-group", name: "Toggle Group", Demo: ToggleGroupDemo },
  { slug: "breadcrumb", name: "Breadcrumb", Demo: BreadcrumbDemo },
  { slug: "context-menu", name: "Context Menu", Demo: ContextMenuDemo },
  { slug: "dropdown-menu", name: "Dropdown Menu", Demo: DropdownMenuDemo },
  { slug: "pagination", name: "Pagination", Demo: PaginationDemo, wide: true },
  { slug: "popover", name: "Popover", Demo: PopoverDemo },
  { slug: "profile-menu", name: "Profile Menu", Demo: ProfileMenuDemo },
  { slug: "segmented-control", name: "Segmented Control", Demo: SegmentedControlDemo },
];
