/**
 * Copy text from a click. The console is served over plain http (10.190.7.99:3000), where browsers don't expose
 * navigator.clipboard (secure contexts only), so the Clipboard API is tried first and a hidden-textarea
 * execCommand("copy") is the fallback; it still works over http inside a user gesture. False = both failed.
 */
export async function copyText(text: string, env: { doc?: Document; nav?: Navigator; secure?: boolean } = {}): Promise<boolean> {
  const doc = env.doc ?? document;
  const nav = env.nav ?? navigator;
  const secure = env.secure ?? (typeof window !== "undefined" && window.isSecureContext);
  if (secure && nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      // permission refused or focus lost: try the fallback
    }
  }
  return execCopy(doc, text);
}

function execCopy(doc: Document, text: string): boolean {
  const back = doc.activeElement as HTMLElement | null; // the copy button: focus returns to it
  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", ""); // no on-screen keyboard, no edit
  Object.assign(ta.style, { position: "fixed", top: "0", left: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
  doc.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
    back?.focus?.();
  }
}
