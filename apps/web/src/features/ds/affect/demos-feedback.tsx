"use client";

import { useState } from "react";
import { Button } from "@starterkit/ui/affect/button";
import { CodeBlock } from "@starterkit/ui/affect/code-block";
import { DecisionInbox, type Decision } from "@starterkit/ui/affect/decision-inbox";
import { AlertDialog, Dialog } from "@starterkit/ui/affect/dialog";
import { EmptyState } from "@starterkit/ui/affect/empty-state";
import { Kbd } from "@starterkit/ui/affect/kbd";
import { NotificationStack, type Notice } from "@starterkit/ui/affect/notification-stack";
import { ProgressTracker } from "@starterkit/ui/affect/progress-tracker";
import { Loading, Skeleton } from "@starterkit/ui/affect/skeleton";
import { Spinner } from "@starterkit/ui/affect/spinner";
import { ToolCallCard, ToolCallGroup } from "@starterkit/ui/affect/tool-call-card";
import { Tooltip } from "@starterkit/ui/affect/tooltip";
import type { AffectDemo } from "./types";

const DECISIONS: Decision[] = [
  { id: "d1", title: "Approve the Q3 vendor contract", detail: "Northwind Supply, 12 months", primary: "Approve", secondary: "Defer" },
  { id: "d2", title: "Merge the pricing page redesign", detail: "Reviewed by Maya Chen", primary: "Merge", secondary: "Request changes" },
  { id: "d3", title: "Renew the design tool licence", detail: "8 seats", primary: "Renew", secondary: "Skip", collapsed: true },
];

function DecisionInboxDemo() {
  const [last, setLast] = useState("No answer yet");
  return (
    <div className="grid gap-3">
      <DecisionInbox decisions={DECISIONS} onDecide={(d, a) => setLast(`${d.title}: ${a === "primary" ? d.primary : d.secondary}`)} />
      <p className="text-body-sm text-fg-2">{last}</p>
    </div>
  );
}

function DialogDemo() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog
        trigger={<Button variant="secondary">Open dialog</Button>}
        title="Rename project"
        description="The new name shows for everyone on the team."
        footer={<Button variant="primary">Save name</Button>}
      >
        <p className="text-body-sm text-fg-2">Current name: Orchard redesign.</p>
      </Dialog>
      <AlertDialog
        trigger={<Button variant="destructive">Delete project</Button>}
        title="Delete Orchard redesign?"
        description="Its 14 files are removed and cannot be restored."
        confirmLabel="Delete project"
        cancelLabel="Keep project"
        danger
        onConfirm={() => setConfirmed(true)}
      />
      {confirmed ? <span className="text-label text-fg-3">Delete confirmed</span> : null}
    </div>
  );
}

function EmptyStateDemo() {
  return (
    <EmptyState
      title="No invoices yet"
      text="Invoices appear here once a customer is billed."
      action={<Button variant="secondary">Create invoice</Button>}
    />
  );
}

const NOTICES: Notice[] = [
  { id: "n1", badge: "New", title: "Export finished", text: "Your report for October is ready.", pattern: "orbit", action: { label: "Open report" } },
  { id: "n2", title: "Maya joined the team", text: "She can now edit the Orchard board.", pattern: "grid" },
  { id: "n3", badge: "Tip", title: "Invite a teammate", text: "Shared boards update live.", pattern: "rays" },
];

function NotificationStackDemo() {
  const [notices, setNotices] = useState<Notice[]>(NOTICES);
  const [n, setN] = useState(0);
  const push = () => {
    setNotices((list) => [{ id: `p${n}`, title: `Backup ${n + 1} complete`, text: "All 3 volumes were copied.", pattern: "grid" }, ...list]);
    setN((v) => v + 1);
  };
  return (
    <div className="grid gap-3">
      <Button variant="secondary" onClick={push}>Push notification</Button>
      <NotificationStack notices={notices} onDismiss={(x) => setNotices((list) => list.filter((i) => i.id !== x.id))} />
    </div>
  );
}

const STEPS = [
  { id: "s1", label: "Create an account", done: true },
  { id: "s2", label: "Invite a teammate" },
  { id: "s3", label: "Connect a data source" },
  { id: "s4", label: "Publish the first board" },
];

function ProgressTrackerDemo() {
  return (
    <div className="grid gap-4">
      <ProgressTracker title="Getting started" steps={STEPS} />
      <ProgressTracker title="Auto play" steps={STEPS.map((s) => ({ ...s, done: false }))} autoPlay />
    </div>
  );
}

function SkeletonDemo() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="grid gap-3">
      <Button variant="secondary" onClick={() => setLoaded((v) => !v)}>{loaded ? "Show loading" : "Show content"}</Button>
      {loaded ? (
        <div className="grid gap-1">
          <p className="text-body font-medium text-fg">Maya Chen</p>
          <p className="text-body-sm text-fg-2">Product designer, Orchard team</p>
        </div>
      ) : (
        <Loading label="Loading profile" className="grid gap-2">
          <Skeleton width={160} height={16} />
          <Skeleton line />
          <Skeleton line width="60%" />
          <Skeleton width={48} height={48} radius="50%" />
        </Loading>
      )}
    </div>
  );
}

function SpinnerDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Spinner />
      <Spinner size={20} />
      <Spinner size={32} label="Loading" />
      <Button variant="primary" loading>Saving</Button>
    </div>
  );
}

function TooltipDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tooltip content="Save changes" shortcut="mod+s"><Button variant="secondary">Save</Button></Tooltip>
      <Tooltip content="Appears below" side="bottom"><Button variant="ghost">Bottom</Button></Tooltip>
      <Tooltip content="Aligned to the start" side="right" align="start"><Button variant="ghost">Right</Button></Tooltip>
      <Tooltip content="You need edit access" disabled><Button variant="ghost">Disabled tip</Button></Tooltip>
    </div>
  );
}

const SAMPLE_CODE = `import { createClient } from "orchard";

const client = createClient({ region: "eu-west", retries: 3 });

// Fetch the ten latest boards
async function latest() {
  const boards = await client.boards.list({ limit: 10 });
  return boards.map((b) => b.title);
}`;

const SAMPLE_JSON = `{
  "name": "orchard",
  "private": true,
  "scripts": { "build": "orchard build" }
}`;

function CodeBlockDemo() {
  return (
    <div className="grid gap-3">
      <CodeBlock code={SAMPLE_CODE} language="ts" filename="client.ts" showLineNumbers highlightLines={[6, 7]} />
      <CodeBlock code={SAMPLE_JSON} language="json" />
      <CodeBlock code={"bun add orchard\nbun run build"} language="bash" />
    </div>
  );
}

function KbdDemo() {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Kbd keys="mod+k" />
        <Kbd keys={["shift", "enter"]} />
        <Kbd keys="esc" />
        <Kbd keys="mod+k" size="md" />
      </div>
      <p className="text-body-sm text-fg-2">Mac: <Kbd keys="mod+shift+p" platform="mac" /> Other: <Kbd keys="mod+shift+p" platform="other" /></p>
    </div>
  );
}

const SEARCH_MS = 1240;
const FETCH_MS = 380;

function ToolCallCardDemo() {
  const [done, setDone] = useState(false);
  const [start, setStart] = useState<number | undefined>(undefined);
  const run = () => {
    setStart(Date.now());
    setDone(false);
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={run}>Restart running call</Button>
        <Button variant="secondary" onClick={() => setDone(true)}>Finish call</Button>
      </div>
      <ToolCallCard
        name="search_web"
        summary="Searched for 'orchard pricing'"
        status={done ? "success" : "running"}
        startedAt={start}
        duration={done ? SEARCH_MS : undefined}
        args={{ query: "orchard pricing", limit: 5 }}
        result={{ hits: 5, top: "orchard.example/pricing" }}
      />
      <ToolCallCard
        name="read_file"
        summary="Read notes.md"
        status="success"
        duration={FETCH_MS}
        args={{ path: "notes.md" }}
        result="Meeting notes, 42 lines."
      />
      <ToolCallCard
        name="send_email"
        summary="Send the weekly summary"
        status="error"
        error="Mailbox unavailable for maya@orchard.test"
        args={{ to: "maya@orchard.test" }}
        onRetry={() => undefined}
      />
      <ToolCallGroup>
        <ToolCallCard name="list_boards" summary="Listed boards" status="success" duration={FETCH_MS} />
        <ToolCallCard name="get_board" summary="Opened Orchard board" status="success" duration={SEARCH_MS} />
      </ToolCallGroup>
    </div>
  );
}

export const DEMOS: readonly AffectDemo[] = [
  { slug: "decision-inbox", name: "Decision Inbox", Demo: DecisionInboxDemo },
  { slug: "dialog", name: "Dialog", Demo: DialogDemo },
  { slug: "empty-state", name: "Empty State", Demo: EmptyStateDemo },
  { slug: "notification-stack", name: "Notification Stack", Demo: NotificationStackDemo },
  { slug: "progress-tracker", name: "Progress Tracker", Demo: ProgressTrackerDemo },
  { slug: "skeleton", name: "Skeleton", Demo: SkeletonDemo },
  { slug: "spinner", name: "Spinner", Demo: SpinnerDemo },
  { slug: "tooltip", name: "Tooltip", Demo: TooltipDemo },
  { slug: "code-block", name: "Code Block", Demo: CodeBlockDemo, wide: true },
  { slug: "kbd", name: "Kbd", Demo: KbdDemo },
  { slug: "tool-call-card", name: "Tool Call Card", Demo: ToolCallCardDemo, wide: true },
];
