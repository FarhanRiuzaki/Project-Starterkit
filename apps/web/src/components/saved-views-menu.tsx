"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { ViewsIcon } from "@starterkit/ui/ui/icons";

function Trigger({ pending = false, onClick }: { pending?: boolean; onClick?: () => void }) {
  return <Button variant="secondary" aria-label={pending ? "Opening views" : "Views"} aria-busy={pending || undefined}
    aria-haspopup="menu" aria-expanded={false} disabled={pending} onClick={onClick} className="gap-1.5 px-2.5 text-body-sm font-normal">
    <Icon icon={ViewsIcon} className="size-4 text-fg-3" />
    <span className="max-md:sr-only">{pending ? "Opening views…" : "Views"}</span>
  </Button>;
}

const Content = dynamic(() => import("./saved-views-menu-impl").then(m => m.SavedViewsMenuImpl), {
  ssr: false, loading: () => <Trigger pending />,
});

/** The first press loads the user's view controller and opens it; later presses retain its fetched state. */
export function SavedViewsMenu() {
  const [loaded, setLoaded] = useState(false);
  return loaded ? <Content /> : <Trigger onClick={() => setLoaded(true)} />;
}
