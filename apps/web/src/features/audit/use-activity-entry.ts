"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { FILTER_EXTERNAL_CHANGE } from "@starterkit/ui/ds/filter-layout";
import { activityCloseHref, activityInvestigationHref, activityOpenHref } from "@/lib/shared/activity-links";

const PATH = "/audit/activity";
const MARKER = "skActivityEntry";
/** URL identity, with local provenance only for a row-open Back operation; shared links never depend on memory. */
export function useActivityEntry() {
  const search = useSearchParams();
  const origin = useRef<{ marker: string; id: string; href: string } | null>(null);
  const trigger = useRef<{ node: HTMLButtonElement; id: string } | null>(null);
  const closing = useRef(false);
  useEffect(() => { closing.current = false; }, [search]);
  const returnFocus = useCallback((id: string) => {
    if (window.location.pathname !== PATH || new URLSearchParams(window.location.search).has("entry")) return;
    const target = trigger.current?.id === id.toLowerCase() ? trigger.current.node : null;
    if (target?.isConnected && !target.disabled && target.getClientRects().length) target.focus();
    else document.querySelector<HTMLElement>("#content h1")?.focus();
  }, []);
  const open = useCallback((id: string, button: HTMLButtonElement) => {
    if (window.location.pathname !== PATH) return;
    const current = new URLSearchParams(window.location.search);
    if (current.get("entry")?.toLowerCase() === id.toLowerCase()) return;
    trigger.current = { node: button, id: id.toLowerCase() }; closing.current = false;
    const owned = origin.current && window.history.state?.[MARKER] === origin.current.marker && current.get("entry") === origin.current.id && window.location.href === origin.current.href;
    const href = activityOpenHref(window.location.search, id);
    if (current.has("entry")) {
      window.history.replaceState(owned ? { [MARKER]: origin.current!.marker } : null, "", href);
      origin.current = owned ? { ...origin.current!, id: id.toLowerCase(), href: window.location.href } : null;
      return;
    }
    const marker = crypto.randomUUID();
    // Next copies its own history internals; supplying __NA ourselves would bypass its URL subscription.
    window.history.pushState({ [MARKER]: marker }, "", href);
    origin.current = { marker, id: id.toLowerCase(), href: window.location.href };
  }, []);
  const close = useCallback(() => {
    if (window.location.pathname !== PATH || closing.current) return;
    const current = new URLSearchParams(window.location.search);
    if (!current.has("entry")) return;
    closing.current = true;
    if (origin.current && window.history.state?.[MARKER] === origin.current.marker && current.get("entry") === origin.current.id && window.location.href === origin.current.href) window.history.back();
    else window.history.replaceState(null, "", activityCloseHref(current.toString()));
  }, []);
  const investigate = useCallback((entry: string, filter: { actorId: string } | { targetType: string; targetId: string }) => {
    if (window.location.pathname !== PATH || new URLSearchParams(window.location.search).get("entry")?.toLowerCase() !== entry.toLowerCase()) return;
    window.dispatchEvent(new Event(FILTER_EXTERNAL_CHANGE));
    window.history.pushState(null, "", activityInvestigationHref(window.location.search, filter));
  }, []);
  return { present: search.has("entry"), id: search.get("entry") ?? "", open, close, investigate, returnFocus };
}
