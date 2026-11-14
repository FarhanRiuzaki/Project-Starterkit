"use client";

import { useState } from "react";
import { Avatar, AvatarGroup } from "@starterkit/ui/affect/avatar";
import { Badge } from "@starterkit/ui/affect/badge";
import { Button } from "@starterkit/ui/affect/button";
import { Card, CardContent, CardFooter, CardHeader } from "@starterkit/ui/affect/card";
import { ChangeSummary, type MetricChange } from "@starterkit/ui/affect/change-summary";
import { AssistantMark, CommentThread, type ThreadMessage } from "@starterkit/ui/affect/comment-thread";
import { EmailDraft } from "@starterkit/ui/affect/email-draft";
import { HoverCard } from "@starterkit/ui/affect/hover-card";
import { MessageActions, MessageText } from "@starterkit/ui/affect/message-actions";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@starterkit/ui/affect/resizable";
import { ScrollArea } from "@starterkit/ui/affect/scroll-area";
import { Separator } from "@starterkit/ui/affect/separator";
import { SmartRecommendation } from "@starterkit/ui/affect/smart-recommendation";
import { ThinkingLoader } from "@starterkit/ui/affect/thinking-loader";
import { Kbd, TipsPanel } from "@starterkit/ui/affect/tips-panel";
import { TreeView, type TreeNode } from "@starterkit/ui/affect/tree-view";
import type { AffectDemo } from "./types";

function AvatarDemo() {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name="Mara Lindqvist" size={40} status="online" />
        <Avatar name="Tomas Reyes" size={32} status="away" />
        <Avatar name="Ines Okafor" size={24} status="busy" />
        <Avatar name="Platform team" shape="square" size={32} />
        <Avatar name="Triage agent" kind="agent" seed="triage" size={32} />
        <Avatar name="Review agent" kind="agent" seed="review" size={32} working />
      </div>
      <AvatarGroup size={32} max={3} total={9} aria-label="9 reviewers">
        <Avatar seed="a" name="Mara Lindqvist" />
        <Avatar seed="b" name="Tomas Reyes" />
        <Avatar seed="c" name="Ines Okafor" />
        <Avatar seed="d" name="Jonas Weber" />
      </AvatarGroup>
    </div>
  );
}

function BadgeDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Queued</Badge>
      <Badge tone="info" live>Running</Badge>
      <Badge tone="success">Done</Badge>
      <Badge tone="warning" dot>Needs you</Badge>
      <Badge tone="danger">Failed</Badge>
      <Badge tone="purple" size="md">Beta</Badge>
      <Badge tone="info" count={7} />
      <Badge tone="danger" count={130} />
    </div>
  );
}

const CHANGES: MetricChange[] = [
  { label: "Active users", change: "Up 6.1% to 18.2K", tone: "good" },
  { label: "Churn", change: "Down to 2.1% from 2.6%", tone: "good", direction: "down" },
  { label: "Support tickets", change: "Up 14% to 312", tone: "bad", direction: "up" },
  { label: "Trial length", change: "Unchanged at 14 days", tone: "neutral" },
];

function ChangeSummaryDemo() {
  return <ChangeSummary period="This week" changes={CHANGES} />;
}

function HoverCardDemo() {
  return (
    <HoverCard
      width={256}
      openDelay={200}
      content={
        <div className="grid gap-1">
          <strong className="text-body-sm text-fg">Triage agent</strong>
          <p className="text-body-sm text-fg-2">Sorts new tickets and drafts the first reply.</p>
          <p className="text-label text-fg-3">Running, 142 tickets this week</p>
        </div>
      }
    >
      <a href="#hover-card" className="text-body-sm text-fg underline">
        Triage agent
      </a>
    </HoverCard>
  );
}

function Pane({ children }: { children: string }) {
  return <div className="grid h-full place-items-center p-3 text-body-sm text-fg-2">{children}</div>;
}

function ResizableDemo() {
  return (
    <div className="h-56 rounded-lg border border-line">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50} collapsible>
          <Pane>Runs</Pane>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize the runs list" />
        <ResizablePanel defaultSize={70} minSize={40}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={65}>
              <Pane>Output</Pane>
            </ResizablePanel>
            <ResizableHandle aria-label="Resize the log" />
            <ResizablePanel defaultSize={35} minSize={15} collapsible>
              <Pane>Log</Pane>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

const SOURCES = [
  "Quarterly retention review",
  "Onboarding funnel notes",
  "Billing migration plan",
  "Support macro audit",
  "Pricing page experiment",
  "Incident follow-ups",
  "Roadmap draft v3",
  "Interview synthesis",
  "Release checklist",
  "Data export policy",
];

function ScrollAreaDemo() {
  return (
    <ScrollArea maxHeight={176} fade aria-label="Sources" className="rounded-lg border border-line">
      <ul className="grid gap-1 p-3">
        {SOURCES.map((title, i) => (
          <li key={title} className="text-body-sm text-fg-2">
            {title} <span className="text-label text-fg-3">source {i + 1}</span>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

function SeparatorDemo() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-body-sm text-fg-2">
        <span>12 runs</span>
        <Separator orientation="vertical" />
        <span>1 failed</span>
        <Separator orientation="vertical" />
        <span>3 queued</span>
      </div>
      <Separator />
      <Separator label="or" />
    </div>
  );
}

const TREE: TreeNode[] = [
  {
    id: "prompts",
    label: "prompts",
    children: [
      { id: "prompts/system", label: "system.md", meta: "1 KB" },
      { id: "prompts/tools", label: "tools.md", meta: "3 KB" },
      { id: "prompts/archive", label: "archive", children: [] },
    ],
  },
  { id: "evals", label: "evals", children: [{ id: "evals/smoke", label: "smoke.json" }] },
  { id: "agent", label: "agent.yaml", meta: "2 KB" },
  { id: "locked", label: "secrets.env", disabled: true },
];

function TreeViewDemo() {
  const [selected, setSelected] = useState<string | null>("prompts/system");
  return (
    <TreeView
      aria-label="Project files"
      items={TREE}
      defaultExpanded={["prompts"]}
      selected={selected}
      onSelect={(id) => setSelected(id)}
    />
  );
}

function CardDemo() {
  return (
    <Card>
      <CardHeader
        title="Support triage"
        description="Sorts new tickets and drafts the first reply"
        icon={<Avatar kind="agent" seed="triage" name="Triage agent" size={24} />}
        action={<Badge tone="info" live>Running</Badge>}
      />
      <CardContent>
        <p className="text-body-sm text-fg-2">142 tickets this week, 96% resolved.</p>
      </CardContent>
      <CardFooter>
        Started 2 min ago
        <Button size="sm" variant="secondary" style={{ marginInlineStart: "auto" }}>
          Open
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmailDraftDemo() {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <EmailDraft
        reference="SUB-1182"
        account="Northwind Logistics"
        amount="$8,900"
        status="Renews in 5 days"
        agent="Renewal agent"
        contacts={[
          { name: "Jonas Weber", email: "jonas@example.com" },
          { name: "Ines Okafor", email: "ines@example.com" },
        ]}
        attachment="Renewal-quote.pdf"
        link={{ label: "Review quote", href: "#quote" }}
        onSend={(email) => setSent(email.to.name)}
        onDiscard={() => setSent(null)}
      />
      {sent ? (
        <p role="status" className="text-label text-fg-3">
          Draft sent to {sent}.
        </p>
      ) : null}
    </div>
  );
}

function SmartRecommendationDemo() {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <SmartRecommendation
        options={[
          { id: "incremental", label: "Incremental sync", reason: "Only 4% of rows changed since the last run.", signal: 3 },
          { id: "full", label: "Full refresh", reason: "Rebuilds every table.", signal: 1 },
          { id: "paused", label: "Pause until Monday", reason: "No new data expected.", signal: 0 },
        ]}
        onAccept={(o) => setPicked(o.label)}
        onUndo={() => setPicked(null)}
      />
      <p role="status" className="text-label text-fg-3">
        {picked ? `Accepted: ${picked}` : "Nothing accepted yet"}
      </p>
    </div>
  );
}

function TipsPanelDemo() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return <Button variant="secondary" onClick={() => setOpen(true)}>Show tips</Button>;
  }
  return (
    <TipsPanel
      onClose={() => setOpen(false)}
      tips={[
        { id: "search", title: "Quick search", description: <>Press <Kbd>⌘K</Kbd> to jump anywhere.</>, action: "Try it", doneLabel: "Tried" },
        { id: "views", title: "Saved views", description: "Keep a filter set under a name.", action: "Open views", doneLabel: "Opened" },
        { id: "pro", title: "Ready for the next plan?", description: "Unlimited projects and priority support.", action: "See plans", primary: true },
      ]}
    />
  );
}

const BASE = 1767268800000;
const MARA = { name: "Mara Lindqvist" };
const ATLAS = { name: "Atlas", avatar: <AssistantMark />, assistant: true };

const THREAD: ThreadMessage[] = [
  { id: "m1", author: { name: "Tomas Reyes" }, createdAt: BASE, text: "Can we ship the export change this week?" },
  { id: "m2", author: MARA, createdAt: BASE + 600000, text: "Depends on the audit review. Ask @Atlas for the open items." },
];

function CommentThreadDemo() {
  return (
    <CommentThread
      title="Export change"
      messages={THREAD}
      currentUser={MARA}
      assistant={ATLAS}
      onReply={async (text) => {
        if (!text.includes("@Atlas")) return undefined;
        await new Promise((r) => setTimeout(r, 1500));
        return {
          id: `a${text.length}`,
          author: ATLAS,
          createdAt: Date.now(),
          text: "Two items are open: the CSV cap and the retention note.",
          status: "Checked 2 sources",
          details: ["Audit review notes", "Export contract"],
        };
      }}
    />
  );
}

const VERSIONS = [
  "The export runs nightly and keeps the last 30 files.",
  "Exports run every night; the last 30 files are kept.",
];

function MessageActionsDemo() {
  const [versions, setVersions] = useState(VERSIONS);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const regenerate = () => {
    setBusy(true);
    setTimeout(() => {
      setVersions((v) => [...v, `Version ${v.length + 1}: nightly exports, 30 files kept.`]);
      setVersion(versions.length);
      setBusy(false);
    }, 1200);
  };
  return (
    <div data-ui-message className="grid gap-2">
      <MessageText version={version}>
        <p className="text-body-sm text-fg">{versions[version]}</p>
      </MessageText>
      <MessageActions
        text={versions[version]}
        versions={versions}
        version={version}
        onVersionChange={setVersion}
        regenerating={busy}
        onRegenerate={regenerate}
      />
    </div>
  );
}

function ThinkingLoaderDemo() {
  const [done, setDone] = useState(false);
  return (
    <div className="grid justify-items-start gap-3">
      <ThinkingLoader phases={["Thinking", "Searching the sources", "Reading results", "Writing response"]} interval={1500} done={done} loop={!done} />
      <ThinkingLoader variant="plain" size="sm" phases={["Thinking"]} done={done} />
      <Button size="sm" variant="secondary" onClick={() => setDone((d) => !d)}>
        {done ? "Restart" : "Finish"}
      </Button>
    </div>
  );
}

export const DEMOS: readonly AffectDemo[] = [
  { slug: "avatar", name: "Avatar", Demo: AvatarDemo },
  { slug: "badge", name: "Badge", Demo: BadgeDemo },
  { slug: "change-summary", name: "Change Summary", Demo: ChangeSummaryDemo },
  { slug: "hover-card", name: "Hover Card", Demo: HoverCardDemo },
  { slug: "resizable", name: "Resizable", Demo: ResizableDemo },
  { slug: "scroll-area", name: "Scroll Area", Demo: ScrollAreaDemo },
  { slug: "separator", name: "Separator", Demo: SeparatorDemo },
  { slug: "tree-view", name: "Tree View", Demo: TreeViewDemo },
  { slug: "card", name: "Card", Demo: CardDemo },
  { slug: "email-draft", name: "Email Draft", Demo: EmailDraftDemo, wide: true },
  { slug: "smart-recommendation", name: "Smart Recommendation", Demo: SmartRecommendationDemo },
  { slug: "tips-panel", name: "Tips Panel", Demo: TipsPanelDemo },
  { slug: "comment-thread", name: "Comment Thread", Demo: CommentThreadDemo },
  { slug: "message-actions", name: "Message Actions", Demo: MessageActionsDemo },
  { slug: "thinking-loader", name: "Thinking Loader", Demo: ThinkingLoaderDemo },
];
