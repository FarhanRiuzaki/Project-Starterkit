"use client";

import { useState } from "react";
import { Truncate } from "./truncate";
import { Icon } from "../ui/icon";
import { CheckIcon, CopyIcon } from "../ui/icons";
import { toast } from "../ui/toast";
import { copyText } from "../lib/clipboard";

/** Nilai mono yang bisa disalin (ID, IP, domain). Gagal salin → pesan, teks tetap bisa diseleksi. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    // Over plain http the Clipboard API is missing; copyText falls back to execCommand (lib/client/clipboard).
    if (await copyText(value)) {
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } else {
      toast.error("Couldn't copy to the clipboard. Select the text and copy it manually.");
    }
  }
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 font-mono text-mono text-fg">
      <span className="min-w-0 select-all"><Truncate title={value}>{value}</Truncate></span>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-fg-3 hover:bg-tray hover:text-fg">
        {done ? <Icon icon={CheckIcon} className="size-3.5 text-healthy-ink animate-swap" /> : <Icon icon={CopyIcon} className="size-3.5" />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">{done ? "Copied" : ""}</span>
    </span>
  );
}
