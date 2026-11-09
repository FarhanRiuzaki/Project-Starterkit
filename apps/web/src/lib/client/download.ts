import { apiFailure, assertApiPath } from "./api";

/** Export requests and blob/DOM saving load only after the user starts an export. */
export async function download(path: string, fallbackName: string): Promise<string> {
  assertApiPath(path);
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw await apiFailure(res, path);
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url)); // after the click's download has taken the blob
  return name;
}
