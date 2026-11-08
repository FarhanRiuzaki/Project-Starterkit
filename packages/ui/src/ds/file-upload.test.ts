// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileUpload, type UploadFn } from "./file-upload";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
URL.createObjectURL = vi.fn(() => "blob:preview");
URL.revokeObjectURL = vi.fn();

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });
async function mount(upload: UploadFn, props: Record<string, unknown> = {}) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(h(FileUpload, { label: "Attachments", upload, accept: ["image/*", ".pdf"], acceptLabel: "an image or a PDF", maxSize: 1000, maxFiles: 2, ...props })));
}
const file = (name: string, type: string, size = 100) => new File([new Uint8Array(size)], name, { type });
const pick = (files: File[]) => act(async () => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
const rows = () => [...document.querySelectorAll("li")].map((li) => li.textContent);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("FileUpload", () => {
  it("states the limits up front; the picker is a real button described by them", async () => {
    await mount(vi.fn(async () => {}));
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent === "choose files")!;
    expect(document.getElementById(btn.getAttribute("aria-describedby")!)!.textContent).toBe("An image or a PDF, up to 1,000 B, 2 files at most");
    expect(document.querySelector('input[type="file"]')!.getAttribute("tabindex")).toBe("-1");
  });

  it("checks each file first: a wrong type gets its own error and is never sent; a good one uploads with progress and is announced", async () => {
    let report: (r: number) => void = () => {};
    let finish: () => void = () => {};
    const upload = vi.fn((_f: File, o: { onProgress: (r: number) => void }) => { report = o.onProgress; return new Promise<void>((res) => { finish = res; }); });
    await mount(upload);
    await pick([file("notes.exe", "application/x-msdownload"), file("photo.png", "image/png")]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(rows()[0]).toContain("The file must be an image or a PDF.");
    await act(async () => report(0.5));
    expect(document.querySelector('[role="progressbar"]')!.getAttribute("aria-valuetext")).toBe("50%");
    await act(async () => finish()); await flush();
    expect(rows()[1]).toContain("Uploaded");
    expect(document.querySelector('[role="status"]')!.textContent).toBe("photo.png uploaded.");
    expect(document.querySelector("img")!.getAttribute("src")).toBe("blob:preview");
  });

  it("too big is refused before sending; past maxFiles the rest are not added and that is said", async () => {
    const upload = vi.fn(async () => {});
    await mount(upload);
    await pick([file("a.pdf", "application/pdf", 5000), file("b.pdf", "application/pdf"), file("c.pdf", "application/pdf")]);
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toContain("The file must be smaller than 1,000 B.");
    expect(document.querySelector('[role="alert"]')!.textContent).toBe("You can add up to 2 files. 1 wasn't added.");
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("a failed upload offers Try again; Remove takes the row away", async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(undefined);
    await mount(upload);
    await pick([file("doc.pdf", "application/pdf")]); await flush();
    expect(rows()[0]).toContain("The file couldn't be uploaded. Try again.");
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Try doc.pdf again"]')!.click()); await flush();
    expect(rows()[0]).toContain("Uploaded");
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Remove doc.pdf"]')!.click());
    expect(rows()).toHaveLength(0);
  });
});
