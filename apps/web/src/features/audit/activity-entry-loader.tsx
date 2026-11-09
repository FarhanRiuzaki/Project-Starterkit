"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Notice } from "@starterkit/ui/ds/notice";
import { Button } from "@starterkit/ui/ui/button";
import type { ActivityEntryDialog } from "./activity-entry-dialog";
import type { useActivityEntry } from "./use-activity-entry";

const current = (id: string) => window.location.pathname === "/audit/activity" && new URLSearchParams(window.location.search).get("entry") === id;

/** The small nonmodal stage stays in the page; the dialog and diff load only when an entry is opened. */
export function ActivityEntryLoader({ entry, children }: {
  entry: ReturnType<typeof useActivityEntry>;
  children: (notice: ReactNode, pendingEntry?: string) => ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ Dialog?: typeof ActivityEntryDialog; failed?: string }>({});
  const cancelled = useRef(false);
  const { present, id } = entry;
  useEffect(() => {
    if (!present || loaded.Dialog) return;
    cancelled.current = false;
    let active = true;
    import("./activity-entry-dialog").then(module => {
      if (active && !cancelled.current && current(id)) setLoaded({ Dialog: module.ActivityEntryDialog });
    }, () => { if (active && !cancelled.current && current(id)) setLoaded({ failed: id }); });
    return () => { active = false; };
  }, [present, id, loaded.Dialog]);
  const pending = present && !loaded.Dialog;
  const Dialog = loaded.Dialog;
  return <>
    {children(pending ? <EntryOpening key={id} id={id} failed={loaded.failed === id} onClose={() => { cancelled.current = true; entry.close(); }} returnFocus={() => entry.returnFocus(id)} /> : null, pending ? id : undefined)}
    {present && Dialog && <Dialog key={id} id={id} onClose={entry.close} returnFocus={() => entry.returnFocus(id)} onInvestigate={entry.investigate} />}
  </>;
}

function EntryOpening({ id, failed, onClose, returnFocus }: { id: string; failed: boolean; onClose: () => void; returnFocus: () => void }) {
  const cancelled = useRef(false);
  const focus = useRef(returnFocus);
  useEffect(() => { focus.current = returnFocus; }, [returnFocus]);
  const cancel = () => { if (current(id)) { cancelled.current = true; onClose(); } };
  useEffect(() => () => {
    // Successful handoff never restores focus; only an explicit cancellation does.
    if (cancelled.current) requestAnimationFrame(() => focus.current());
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !current(id)) return;
      const overlay = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')].some(node => node.getClientRects().length > 0);
      if (overlay) return;
      event.preventDefault(); cancelled.current = true; onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [id, onClose]);
  return <Notice live tone={failed ? "warn" : "info"}><span className="flex flex-wrap items-center gap-2">
    <span>{failed ? "Couldn't open this activity entry." : "Opening activity entry…"}</span>
    {failed && <Button variant="secondary" size="sm" onClick={() => { if (current(id)) window.location.reload(); }}>Reload page</Button>}
    <Button variant="secondary" size="sm" onClick={cancel}>Cancel</Button>
  </span></Notice>;
}
