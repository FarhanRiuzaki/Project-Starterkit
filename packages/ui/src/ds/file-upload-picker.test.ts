// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { FileItem, FileUpload } from "./file-upload";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ""; });
it("rejects unsupported and oversized files without losing the selected file; accepts a valid replacement", async () => {
  const el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  const existing = new File(["original"], "original.pdf", { type: "application/pdf" });
  const onFilesChange = vi.fn();
  await act(async () => root.render(h(FileUpload, { label: "Attachment", files: [existing], onFilesChange, accept: ".pdf", maxBytes: 10 })));
  const input = el.querySelector("input")!;
  async function choose(file: File) {
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  }
  await choose(new File(["bad"], "code.js"));
  expect(el.textContent).toContain("Choose a supported file type."); expect(onFilesChange).not.toHaveBeenCalled(); expect(el.textContent).toContain("original.pdf");
  await choose(new File(["01234567890"], "large.pdf"));
  expect(el.textContent).toContain("A file exceeds the size limit."); expect(onFilesChange).not.toHaveBeenCalled();
  const good = new File(["new"], "new.pdf"); await choose(good);
  expect(onFilesChange).toHaveBeenCalledWith([good]); expect(el.querySelector('[role="alert"]')).toBeNull();
});

it("drag feedback survives child boundaries and stays off while disabled or uploading", async () => {
  const el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  const props = { label: "Attachment", files: [], onFilesChange: vi.fn(), accept: ".pdf", maxBytes: 100 };
  await act(async () => root.render(h(FileUpload, props)));
  const dropzone = el.querySelector('[data-slot="file-dropzone"]')!;
  const child = dropzone.querySelector("span")!;
  const send = async (target: Element, type: string) => { await act(async () => target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))); };
  await send(dropzone, "dragenter"); await send(child, "dragenter"); await send(dropzone, "dragleave");
  expect(dropzone.getAttribute("data-dragging")).toBe("true");
  await send(child, "dragleave");
  expect(dropzone.hasAttribute("data-dragging")).toBe(false);
  for (const state of [{ disabled: true }, { progress: 30 }]) {
    await act(async () => root.render(h(FileUpload, { ...props, ...state })));
    await send(dropzone, "dragenter");
    expect(dropzone.hasAttribute("data-dragging")).toBe(false);
  }
});

it("removes only the chosen file and returns focus to browse", async () => {
  const el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  const first = new File(["a"], "first.csv"), second = new File(["b"], "second.csv");
  const onFilesChange = vi.fn();
  await act(async () => root.render(h(FileUpload, { label: "Import users", files: [first, second], onFilesChange, accept: ".csv", maxBytes: 100, multiple: true })));
  await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="Remove first.csv"]')!.click());
  expect(onFilesChange).toHaveBeenCalledWith([second]);
  expect(document.activeElement).toBe(el.querySelector('[data-slot="file-dropzone-trigger"]'));
});

it("keeps uploading at zero cancellable, without exposing remove or browse actions", async () => {
  const el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  const onCancel = vi.fn();
  await act(async () => root.render(h(FileUpload, { label: "Import users", files: [new File(["a"], "users.csv")], onFilesChange: vi.fn(), accept: ".csv", maxBytes: 100, progress: 0, onCancel })));
  expect(el.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("0");
  expect(el.querySelector<HTMLButtonElement>('[data-slot="file-dropzone-trigger"]')!.disabled).toBe(true);
  expect(el.querySelector('[aria-label="Remove users.csv"]')).toBeNull();
  await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="Cancel upload of users.csv"]')!.click());
  expect(onCancel).toHaveBeenCalledOnce();
});

it("announces confirmed success and actionable file errors without losing metadata", async () => {
  const el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  const onRemove = vi.fn();
  await act(async () => root.render(h(FileItem, { name: "users.csv", size: 248 * 1024, rows: 412, state: "success", onRemove })));
  expect(el.textContent).toContain("248 KB · 412 rows");
  expect(el.querySelector('[role="status"]')?.textContent).toContain("Upload complete");
  await act(async () => root.render(h(FileItem, { name: "users.csv", state: "error", error: "Row 17: email is missing", onRemove })));
  expect(el.querySelector('[role="alert"]')?.textContent).toBe("Row 17: email is missing");
  await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="Remove users.csv"]')!.click());
  expect(onRemove).toHaveBeenCalledOnce();
});

it("ignores an empty picker result and locks file actions while disabled", async () => {
  const el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  const onFilesChange = vi.fn(), file = new File(["a"], "users.csv");
  const props = { label: "Import users", files: [file], onFilesChange, accept: ".csv", maxBytes: 100 };
  await act(async () => root.render(h(FileUpload, props)));
  const input = el.querySelector("input")!;
  Object.defineProperty(input, "files", { configurable: true, value: [] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(onFilesChange).not.toHaveBeenCalled();
  await act(async () => root.render(h(FileUpload, { ...props, disabled: true })));
  expect(el.querySelector<HTMLButtonElement>('[aria-label="Remove users.csv"]')!.disabled).toBe(true);
});
