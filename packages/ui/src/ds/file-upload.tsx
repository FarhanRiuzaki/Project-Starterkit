"use client";

import type { ComponentProps } from "react";
import { FilePicker } from "./file-upload-picker";
import { ManagedFileUpload } from "./file-upload-managed";
export { FileItem, ProgressBar, type FileItemProps } from "./file-upload-picker";
export type { UploadFn, UploadItem, UploadStatus } from "./file-upload-managed";

/** Retain both established selection contracts while sharing one public component. */
export function FileUpload(props: ComponentProps<typeof FilePicker> | ComponentProps<typeof ManagedFileUpload>) {
  return "files" in props ? <FilePicker {...props} /> : <ManagedFileUpload {...props} />;
}
