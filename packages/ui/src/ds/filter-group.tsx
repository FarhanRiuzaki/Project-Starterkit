"use client";

import { createContext, type ComponentType, type ReactNode, useContext } from "react";

/** Group state lives above the deferred panel, so dismiss/reopen preserves it. */
export const FilterGroups = createContext<{ collapsed: Record<string, boolean>; toggle: (label: string) => void } | null>(null);
export const FilterFocusId = createContext("");
type Props = { label: string; value: string; children: ReactNode };
export type FilterChecksProps = { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void;
  search?: { value: string; onChange: (value: string) => void; loading?: boolean; error?: boolean; more?: boolean; onMore?: () => void; onRetry?: () => void } };
export type FilterSearchProps = { label: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number; onCommit: () => void };
export const FilterGroupRenderer = createContext<{ Group: ComponentType<Props>; Checks: ComponentType<FilterChecksProps>; Search: ComponentType<FilterSearchProps> } | null>(null);
/** The disclosure renderer loads with the panel; initial routes only need this small facade. */
export function FilterGroup(props: Props) {
  const renderer = useContext(FilterGroupRenderer);
  return renderer ? <renderer.Group {...props} /> : props.children;
}
export function FilterChecks(props: FilterChecksProps) {
  const renderer = useContext(FilterGroupRenderer);
  return renderer ? <renderer.Checks {...props} /> : null;
}
