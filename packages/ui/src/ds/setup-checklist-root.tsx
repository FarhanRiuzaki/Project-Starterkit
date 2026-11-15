"use client";

import { type FocusEvent, type ReactNode, useEffect, useRef } from "react";

const LEFT = '[data-slot="setup-task"]:not([data-done])';

/**
 * Root of `SetupChecklist` and its one client part: keeps focus in the checklist when the control that had it goes
 * away (a task that becomes done unmounts its action; the last one unmounts the whole list; "Reset" inside the
 * completion message unmounts the message). Like `DataTable` after a row goes away, it moves only focus that was lost
 * that way, never focus the user put somewhere else: to the nearest action left in the same group (the next, else the
 * one before), else the summary of the open group with a task left, else the completion message, else the group's
 * own summary.
 */
export function SetupChecklistRoot({ className, children }: { className?: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const last = useRef<{ el: Element; group: Element | null; index: number } | null>(null);
  // After every commit: the checklist has no state of its own, so any render may be the one that removed the control.
  useEffect(() => {
    const was = last.current, now = document.activeElement;
    if (!was || was.el.isConnected) return;
    last.current = null;
    if (now && now !== document.body && now.isConnected) return;
    const actions = [...(was.group?.querySelectorAll('[data-slot="setup-task"]') ?? [])].map((t) => (t.matches(LEFT) ? t.querySelector<HTMLElement>("a[href], button") : null));
    const target = actions.slice(was.index + 1).find(Boolean) ?? actions.slice(0, was.index).reverse().find(Boolean)
      ?? [...root.current!.querySelectorAll("details[open]")].find((d) => d.querySelector(LEFT))?.querySelector<HTMLElement>("summary")
      ?? root.current!.querySelector<HTMLElement>('[role="status"][tabindex]')
      ?? was.group?.querySelector<HTMLElement>("summary");
    target?.focus();
  });
  const onFocus = (e: FocusEvent) => {
    const task = e.target.closest('[data-slot="setup-task"]');
    last.current = { el: e.target, group: e.target.closest('[data-slot="setup-group"]'), index: task ? [...task.parentElement!.children].indexOf(task) : -1 };
  };
  return <div ref={root} data-slot="setup-checklist" className={className} onFocus={onFocus}>{children}</div>;
}
