"use client";

import { Component, type ReactNode } from "react";
import { isChunkError } from "../lib/chunk-error";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { RefreshIcon } from "../ui/icons";
import { ErrorState } from "./states";

/** The "Reload page" action for a chunk that failed to load (retrying asks for the same missing file). */
export function ReloadButton() {
  return <Button size="sm" variant="secondary" onClick={() => window.location.reload()}><Icon icon={RefreshIcon} />Reload page</Button>;
}

/**
 * Panel-level boundary for code loaded on demand (lazy charts, LazyMount): a chunk that failed to load takes down only
 * this part, which offers "Reload page"; any other error goes on up to the page's error boundary.
 */
export class ChunkBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  render() {
    const { error } = this.state;
    if (error == null) return this.props.children;
    if (!isChunkError(error)) throw error;
    return (
      <ErrorState title="Couldn't load this part of the page"
        cause="A newer version of the app was released while this page was open. Reload the page to get the new version."
        action={<ReloadButton />} />
    );
  }
}
