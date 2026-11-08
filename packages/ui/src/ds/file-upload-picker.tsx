"use client";

import { useId, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { CloseIcon, FileIcon, RemoveIcon, SuccessIcon, UploadIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { formatBytes, formatNumber } from "../lib/format";
import { MeterFill, meterTrack } from "./meter";

const percentage = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export function ProgressBar({ label, value }: { label: string; value?: number }) {
  const pct = value === undefined ? undefined : percentage(value);
  return <div className="grid gap-3"><p className="text-label">{label}</p><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={cn("relative h-2 overflow-hidden rounded-full", meterTrack())}><MeterFill ratio={(pct ?? 30) / 100} tone="normal" /></div><p className="text-caption text-fg-3">{pct === undefined ? "In progress…" : `${formatNumber(pct)}% complete`}</p></div>;
}

export type FileItemProps = { name: string; size?: number; rows?: number; disabled?: boolean } & (
  | { state: "uploading"; progress?: number; onCancel?: () => void; onRemove?: never; error?: never }
  | { state?: "selected" | "success"; onRemove?: () => void; onCancel?: never; progress?: never; error?: never }
  | { state: "error"; error: string; onRemove?: () => void; onCancel?: never; progress?: never }
);

/** One controlled file. Only the feature can confirm success or supply a transport error. */
export function FileItem({ name, size, rows, state = "selected", progress, error, disabled, onCancel, onRemove }: FileItemProps) {
  const uploading = state === "uploading", pct = progress === undefined ? undefined : percentage(progress);
  const metadata = [size === undefined ? null : formatBytes(size), rows === undefined ? null : `${formatNumber(rows)} ${rows === 1 ? "row" : "rows"}`].filter(Boolean).join(" · ");
  return <div data-slot="file-item" data-state={state} className={cn("flex min-w-0 items-center gap-3 rounded-md border bg-card p-3", state === "error" ? "border-down-mark" : "border-line")}>
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-tray"><Icon icon={FileIcon} className="size-4" /></span>
    <div className="grid min-w-0 flex-1 gap-1">
      <p className="truncate text-body font-medium" title={name}>{name}</p>
      {uploading ? <div className="flex min-w-0 items-center gap-2">
        <div role="progressbar" aria-label={`Uploading ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={cn("relative h-1 min-w-0 flex-1 overflow-hidden rounded-full", meterTrack())}><MeterFill ratio={(pct ?? 30) / 100} tone="normal" /></div>
        <span className="shrink-0 text-caption tabular text-fg-2">{pct === undefined ? "Uploading…" : `${formatNumber(pct)}%`}</span>
      </div> : state === "error" ? <p role="alert" className="text-caption break-words text-down-ink">{error}</p> : metadata ? <p className="text-caption text-fg-3">{metadata}</p> : null}
      {state !== "error" && <span role="status" className="sr-only">{uploading ? `Uploading ${name}` : state === "success" ? `Upload complete: ${name}` : `Selected: ${name}`}</span>}
    </div>
    {state === "success" && <Icon icon={SuccessIcon} className="size-4 shrink-0 text-healthy-ink" />}
    {uploading ? onCancel && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Cancel upload of ${name}`} onClick={onCancel}><Icon icon={CloseIcon} /></Button> : onRemove && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remove ${name}`} onClick={onRemove}><Icon icon={RemoveIcon} /></Button>}
  </div>;
}

/** Selection and validation only. Transport, cancellation and progress belong to the calling feature.
 * Compose FileItem directly for independent per-file transfer states. */
export function FilePicker({ label, files, onFilesChange, accept, maxBytes, multiple, disabled, progress, onCancel, error, prompt, description }: {
  label: string; files: readonly File[]; onFilesChange: (files: File[]) => void; accept: string; maxBytes: number; multiple?: boolean; disabled?: boolean; progress?: number; onCancel?: () => void; error?: string; prompt?: string; description?: string;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null), browse = useRef<HTMLButtonElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false), [problem, setProblem] = useState("");
  const unavailable = disabled || progress !== undefined;
  const activeDrag = dragging && !unavailable, issue = problem || error;
  function choose(list: File[]) {
    if (unavailable || !list.length) return;
    const types = accept.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const allowed = (f: File) => !types.length || types.some((t) => t.startsWith(".") ? f.name.toLowerCase().endsWith(t) : t.endsWith("/*") ? f.type.toLowerCase().startsWith(t.slice(0, -1)) : f.type.toLowerCase() === t);
    if (!multiple && list.length > 1) { setProblem("Choose one file."); return; }
    if (list.some((f) => f.size > maxBytes)) { setProblem("A file exceeds the size limit."); return; }
    if (list.some((f) => !allowed(f))) { setProblem("Choose a supported file type."); return; }
    setProblem(""); onFilesChange(list);
  }
  return <div role="group" aria-labelledby={`${id}-label`} className="grid min-w-0 gap-3">
    <p id={`${id}-label`} className="text-label">{label}</p>
    <div data-slot="file-dropzone" data-dragging={activeDrag || undefined} data-disabled={unavailable || undefined} data-invalid={!!issue || undefined}
      className={cn("min-w-0 rounded-lg border border-dashed bg-card", activeDrag ? "border-fg bg-tray ring-1 ring-fg" : "border-control-border", issue && "border-down-mark", unavailable && "opacity-50")}
      onDragEnter={e => { e.preventDefault(); if (!unavailable) { dragDepth.current++; setDragging(true); } }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = unavailable ? "none" : "copy"; }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); choose(Array.from(e.dataTransfer.files)); }}>
      <button ref={browse} type="button" data-slot="file-dropzone-trigger" aria-label={`Choose files for ${label}`} aria-describedby={`${id}-hint${issue ? ` ${id}-error` : ""}`} disabled={unavailable}
        className="grid min-h-40 w-full cursor-pointer justify-items-center content-center gap-2 rounded-lg p-6 text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
        onClick={() => input.current?.click()}>
        <span data-slot="upload-icon" className={cn("mb-1 flex size-10 items-center justify-center rounded-full transition-transform duration-(--dur-fast) ease-standard", activeDrag ? "motion-safe:-translate-y-0.5" : "bg-tray")}><Icon icon={UploadIcon} className="size-5" /></span>
        <span className="text-body font-medium" aria-live="polite">{activeDrag ? "Drop to upload" : prompt ?? (multiple ? "Drop files here or browse" : "Drop a file here or browse")}</span>
        <span id={`${id}-hint`} className="text-caption text-fg-2">{description ?? `${accept || "Any file type"} · up to ${formatBytes(maxBytes)} each`}</span>
      </button>
      <input ref={input} id={id} type="file" hidden accept={accept} multiple={multiple} disabled={unavailable} aria-label={label} onChange={(e) => { choose(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
    {issue && <p id={`${id}-error`} role="alert" className="text-caption text-down-ink">{issue}</p>}
    {files.length > 0 && <ul aria-label={`${label} files`} className="grid min-w-0 gap-3">{files.map((file, i) => <li key={`${file.name}-${file.lastModified}-${i}`} className="min-w-0">
      <FileItem name={file.name} size={file.size} disabled={disabled} {...(progress !== undefined ? { state: "uploading" as const, progress, onCancel } : { onRemove: () => { onFilesChange(files.filter((_, index) => index !== i)); setProblem(""); browse.current?.focus(); } })} />
    </li>)}</ul>}
  </div>;
}
