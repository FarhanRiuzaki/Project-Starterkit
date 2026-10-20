"use client";

import { type ClipboardEvent, type DragEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { formatBytes } from "../lib/format";
import { type AcceptRule, fileProblem, roomFor } from "../lib/upload";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { CloseIcon, FileIcon, RefreshIcon, RemoveIcon, UploadIcon } from "../ui/icons";
import { Progress } from "./progress";

export type UploadStatus = "uploading" | "done" | "error";
export type UploadItem = { id: string; file: File; status: UploadStatus; progress: number; error?: string; preview?: string };
/** Sends one file; reports progress 0–1 and stops when `signal` aborts. Resolves when the server accepted it. */
export type UploadFn = (file: File, opts: { onProgress: (ratio: number) => void; signal: AbortSignal }) => Promise<void>;

let seq = 0;
const nextId = () => `u${++seq}`;

/**
 * File upload (GOV.UK file upload, Uploadcare and Mantine Dropzone practice): a drop zone with a "choose files" button
 * that opens the native file picker (keyboard reachable, described by the limits), and that takes a paste while the
 * button has focus. What is accepted is
 * said up front (`acceptLabel`, size, count). Each file is checked before it is sent (type, size, empty: its own error
 * on its row), then sent at once through `upload` with its own progress bar, Cancel while it runs, Try again after a
 * failure and Remove; images show a thumbnail. Results are announced (role=status). `onChange` gets the files that
 * finished. The page owns the endpoint: `upload` posts to its /api route.
 */
export function FileUpload({ label, upload, accept, acceptLabel, maxSize, maxFiles, multiple = true, onChange, disabled, className }: AcceptRule & {
  label: string; upload: UploadFn; acceptLabel?: string; maxFiles?: number; multiple?: boolean;
  onChange?: (done: File[]) => void; disabled?: boolean; className?: string;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState("");
  const [said, setSaid] = useState("");
  const aborts = useRef(new Map<string, AbortController>());
  const latest = useRef(items);
  useEffect(() => { latest.current = items; }, [items]);

  const patch = (id: string, p: Partial<UploadItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  useEffect(() => { onChange?.(items.filter((x) => x.status === "done").map((x) => x.file)); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps -- report on change only
  // Thumbnails are object URLs: free them when the list goes away.
  useEffect(() => () => { for (const x of latest.current) if (x.preview) URL.revokeObjectURL(x.preview); for (const a of aborts.current.values()) a.abort(); }, []);

  function send(it: UploadItem) {
    const ctrl = new AbortController();
    aborts.current.set(it.id, ctrl);
    patch(it.id, { status: "uploading", progress: 0, error: undefined });
    upload(it.file, { signal: ctrl.signal, onProgress: (r) => patch(it.id, { progress: Math.max(0, Math.min(1, r)) }) })
      .then(() => { patch(it.id, { status: "done", progress: 1 }); setSaid(`${it.file.name} uploaded.`); })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        patch(it.id, { status: "error", error: "The file couldn't be uploaded. Try again." });
        setSaid(`${it.file.name} couldn't be uploaded.`);
      })
      .finally(() => aborts.current.delete(it.id));
  }

  function add(files: File[]) {
    if (disabled || !files.length) return;
    const room = roomFor(items.length, multiple ? files.length : 1, multiple ? maxFiles : 1);
    const taken = files.slice(0, room);
    setNotice(taken.length < files.length
      ? `You can add up to ${multiple ? maxFiles : 1} ${(multiple ? maxFiles : 1) === 1 ? "file" : "files"}. ${files.length - taken.length} ${files.length - taken.length === 1 ? "wasn't" : "weren't"} added.`
      : "");
    const fresh: UploadItem[] = taken.map((file) => {
      const problem = fileProblem(file, { accept, maxSize }, acceptLabel);
      return { id: nextId(), file, status: problem ? "error" : "uploading", progress: 0, error: problem ?? undefined,
        preview: !problem && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined };
    });
    setItems((xs) => (multiple ? [...xs, ...fresh] : fresh));
    for (const it of fresh) if (it.status === "uploading") send(it);
  }

  const remove = (it: UploadItem) => {
    aborts.current.get(it.id)?.abort();
    if (it.preview) URL.revokeObjectURL(it.preview);
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    setSaid(`${it.file.name} removed.`);
  };
  const cancel = (it: UploadItem) => { aborts.current.get(it.id)?.abort(); patch(it.id, { status: "error", error: "Upload cancelled." }); };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); };
  const onPaste = (e: ClipboardEvent) => { const files = [...e.clipboardData.files]; if (files.length) { e.preventDefault(); add(files); } };
  const limits = [acceptLabel, maxSize != null ? `up to ${formatBytes(maxSize)}` : null, multiple && maxFiles ? `${maxFiles} files at most` : null].filter(Boolean).join(", ");

  return (
    <div className={cn("grid gap-3", className)}>
      <div onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop} onPaste={onPaste}
        className={cn("grid justify-items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors duration-(--dur-fast)",
          over ? "border-primary bg-primary-soft" : "border-line-strong bg-tray", disabled && "opacity-60")}>
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-card text-fg-2 shadow-xs"><Icon icon={UploadIcon} className="size-5" /></span>
        <p className="text-body text-fg">
          {over ? "Drop to add" : <>Drag {multiple ? "files" : "a file"} here, paste, or{" "}
            <button type="button" disabled={disabled} aria-describedby={limits ? hintId : undefined} onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-xs font-medium text-primary-ink underline underline-offset-4 outline-none hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">choose {multiple ? "files" : "a file"}</button></>}
        </p>
        {limits && <p id={hintId} className="text-caption text-fg-3">{limits[0]!.toUpperCase() + limits.slice(1)}</p>}
        {/* The native input does the picking (the button opens it); out of the Tab order, so focus lands on the button. */}
        <input ref={inputRef} id={inputId} type="file" tabIndex={-1} aria-hidden="true" aria-label={label} multiple={multiple} disabled={disabled}
          accept={accept?.join(",")} className="sr-only" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {notice && <p role="alert" className="text-body-sm text-down-ink">{notice}</p>}
      {items.length > 0 && (
        <ul aria-label={`${label}: files`} className="grid gap-2">
          {items.map((it) => (
            <li key={it.id} className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5", it.status === "error" ? "border-down-mark/40" : "border-line")}>
              {it.preview
                // A local object URL, not a remote image: next/image doesn't apply (and packages/ui doesn't depend on Next).
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={it.preview} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                : <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-inset text-fg-3"><Icon icon={FileIcon} className="size-5" /></span>}
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="truncate text-body text-fg" title={it.file.name}>{it.file.name}</span>
                  <span className="shrink-0 text-caption tabular text-fg-3">{formatBytes(it.file.size)}</span>
                </div>
                {it.status === "uploading" && <Progress label={`Uploading ${it.file.name}`} value={it.progress} max={1} size="sm" hideLabel />}
                {it.status === "done" && <span className="text-caption text-fg-3">Uploaded</span>}
                {it.status === "error" && <span className="text-caption text-down-ink">{it.error}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {it.status === "uploading" && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Cancel ${it.file.name}`} onClick={() => cancel(it)}><Icon icon={CloseIcon} /></Button>}
                {it.status === "error" && it.error !== undefined && !fileProblem(it.file, { accept, maxSize }, acceptLabel) && (
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Try ${it.file.name} again`} onClick={() => send(it)}><Icon icon={RefreshIcon} /></Button>
                )}
                {it.status !== "uploading" && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${it.file.name}`} onClick={() => remove(it)}><Icon icon={RemoveIcon} /></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <span role="status" aria-live="polite" className="sr-only">{said}</span>
    </div>
  );
}
