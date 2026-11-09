"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BlockedButton, CopyValue, Notice } from "@starterkit/ui/ds";
import { copyText } from "@starterkit/ui/lib/clipboard";
import { formatDateTimeLong } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { Input } from "@starterkit/ui/ui/input";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { actionLabel } from "@starterkit/shared/audit";
import { ACTIVITY_ID_PATTERN, ACTIVITY_TARGET_ID_MAX, ACTIVITY_TARGET_TYPE_MAX } from "@starterkit/shared/audit-investigation";
import type { ActivityDto } from "@starterkit/shared/contracts/audit";
import { api, ApiError, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { activityEntryHref } from "@/lib/shared/activity-links";
import { activityEntry, projectDetail, userDetail } from "@/lib/shared/queries";
import { activitySummary } from "./activity-summary";
import { EntryDialog } from "./entry-dialog";

const currentEntry = (id: string) => window.location.pathname === "/audit/activity" && new URLSearchParams(window.location.search).get("entry")?.toLowerCase() === id.toLowerCase();
const status = (error: unknown) => error instanceof ApiError ? error.status : null;
// Keep this formatter in the lazy detail: expose literal identity boundaries without adding first-load code.
const recordedIdentity = (value: string) => value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value) || value.includes(" · ") ? JSON.stringify(value) : value;

function CopyEntryLink({ id }: { id: string }) {
  const [feedback, setFeedback] = useState<"" | "copied" | "failed">("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const pending = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function copy() {
    if (pending.current || !currentEntry(id)) return;
    pending.current = true; setBusy(true);
    const value = new URL(activityEntryHref(id), window.location.origin).href;
    const copied = await copyText(value);
    pending.current = false;
    if (!alive.current || !currentEntry(id)) return;
    setBusy(false); setUrl(value); setFeedback(copied ? "copied" : "failed");
  }
  return <div className="grid min-w-0 gap-2">
    <div><Button variant="secondary" size="sm" aria-busy={busy || undefined} aria-disabled={busy || undefined} onClick={() => void copy()}>Copy link</Button></div>
    {feedback === "copied" && <p role="status" className="text-body-sm text-fg-2">Link copied.</p>}
    {feedback === "failed" && <>
      <p role="alert" className="text-body-sm text-fg-2">Couldn&apos;t copy the link. Select and copy it below.</p>
      <Input aria-label="Entry link" readOnly value={url} onFocus={event => event.currentTarget.select()} />
    </>}
  </div>;
}

function RecordAvailability({ entry }: { entry: ActivityDto }) {
  const { can } = useAuth();
  const id = entry.target.id.toLowerCase();
  if (!ACTIVITY_ID_PATTERN.test(id)) return null;
  if (entry.target.type === "user" && can("user.view")) return <RecordCheck read={userDetail(id)} href={`/users/${id}`} noun="user" entryId={entry.id} />;
  if (entry.target.type === "project" && can("project.view")) return <RecordCheck read={projectDetail(id)} href={`/projects/${id}`} noun="project" entryId={entry.id} />;
  return null;
}
function RecordCheck({ read, href, noun, entryId }: { read: { key: readonly string[]; url: string }; href: string; noun: string; entryId: string }) {
  const query = useQuery({ queryKey: read.key, queryFn: ({ signal }) => api<unknown>(read.url, { signal }), retry: false, staleTime: 0 });
  let content;
  if (query.isFetching || query.isPending) content = <span role="status" className="text-body-sm text-fg-3">Checking record availability…</span>;
  else if (status(query.error) === 404) content = <span className="text-body-sm text-fg-3">Record unavailable.</span>;
  else if (status(query.error) === 403) content = <span className="text-body-sm text-fg-3">Record access unavailable.</span>;
  else if (query.error) content = <div className="grid gap-2"><p className="text-body-sm text-fg-3">Couldn&apos;t check record availability.</p><div><Button variant="secondary" size="sm" onClick={event => { if (!currentEntry(entryId)) return; event.currentTarget.closest<HTMLElement>('[role="dialog"]')?.focus(); void query.refetch(); }}>Retry check</Button></div></div>;
  else content = <Button asChild variant="secondary" size="sm"><Link href={href} onClick={event => { if (!currentEntry(entryId)) event.preventDefault(); }}>Open {noun}</Link></Button>;
  return <div className="flex min-h-8 items-center">{content}</div>;
}

/** Loaded only with an entry: lookup, record availability, clipboard and semantic changes stay outside first-load JS. */
export function ActivityEntryDialog({ id, onClose, returnFocus, onInvestigate }: {
  id: string; onClose: () => void; returnFocus: () => void;
  onInvestigate: (entryId: string, filter: { actorId: string } | { targetType: string; targetId: string }) => void;
}) {
  const read = activityEntry(id);
  const query = useQuery({ queryKey: read.key, queryFn: ({ signal }) => api<ActivityDto>(read.url!, { signal }), enabled: read.url !== null, retry: false });
  const code = status(query.error);
  const terminal = read.url === null || code === 403 || code === 404;
  const entry = terminal ? undefined : query.data;
  const retry = (button: HTMLButtonElement) => {
    if (!currentEntry(id)) return;
    button.closest<HTMLElement>('[role="dialog"]')?.focus(); void query.refetch();
  };
  if (!entry) {
    const missing = read.url === null || code === 404, forbidden = code === 403;
    const title = missing ? "Activity entry not found" : forbidden ? "Access denied" : query.error ? "Couldn't load this activity entry" : "Loading activity entry…";
    const summary = missing ? "This entry isn't available. Check the link or return to the activity log." : forbidden ? "You don't have permission to view activity entries." : undefined;
    return <EntryDialog title={title} summary={summary} rows={[]} onClose={onClose} returnFocus={returnFocus}>
      {!missing && !forbidden && (query.error ? <div className="grid gap-3"><p role="alert" className="text-body-sm text-fg-2">{errorText(query.error)}</p><div><Button variant="secondary" onClick={event => retry(event.currentTarget)}>Retry</Button></div></div> : <div role="status" aria-label="Loading activity entry" className="grid gap-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-48 w-full" /></div>)}
    </EntryDialog>;
  }
  const actorReason = ACTIVITY_ID_PATTERN.test(entry.actor.id) ? null : "An exact actor ID wasn't recorded for this entry.";
  const targetReason = entry.target.id.length > ACTIVITY_TARGET_ID_MAX ? "This recorded target ID is too long to use as an exact filter." : !entry.target.type || entry.target.type.length > ACTIVITY_TARGET_TYPE_MAX || !entry.target.id || entry.target.type.includes("\0") || entry.target.id.includes("\0") ? "An exact target isn't available for this entry." : null;
  return <EntryDialog title={actionLabel(entry.action)} summary={activitySummary(entry)} onClose={onClose} returnFocus={returnFocus}
    beforeRows={<>
      {query.error && <Notice tone="warn" live>Couldn&apos;t refresh this activity entry; showing the last loaded details. <Button variant="ghost" size="sm" onClick={event => retry(event.currentTarget)}>Retry</Button></Notice>}
      <CopyEntryLink id={entry.id} />
    </>}
    rows={[
      ["Time", formatDateTimeLong(Date.parse(entry.at))],
      ["User", <span key="u">{entry.actor.name} <span className="font-mono text-caption text-fg-3">{entry.actor.id}</span></span>],
      ["Action", <span key="a">{actionLabel(entry.action)} <span className="font-mono text-caption text-fg-3">{entry.action}</span></span>],
      ["Target", <span key="t">{entry.target.label} <span className="font-mono text-caption text-fg-3">{recordedIdentity(entry.target.type)} {recordedIdentity(entry.target.id)}</span></span>],
      ["Entry ID", <CopyValue key="id" value={entry.id} label="entry ID" />],
    ]}
    afterRows={<section aria-labelledby="investigate-title" className="grid min-w-0 gap-2">
      <h3 id="investigate-title" className="text-title-3 text-fg">Investigate</h3>
      <p className="text-body-sm text-fg-3">Other filters and the time range stay in place.</p>
      <div className="flex flex-wrap items-start gap-2">
        <BlockedButton variant="secondary" size="sm" reason={actorReason} onClick={() => onInvestigate(entry.id, { actorId: entry.actor.id })}>View actor activity</BlockedButton>
        <BlockedButton variant="secondary" size="sm" reason={targetReason} onClick={() => onInvestigate(entry.id, { targetType: entry.target.type, targetId: entry.target.id })}>View target activity</BlockedButton>
        <RecordAvailability entry={entry} />
      </div>
    </section>}
    changes={{ action: entry.action, before: entry.before, after: entry.after }} />;
}
