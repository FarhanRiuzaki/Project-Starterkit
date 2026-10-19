/** Kembalikan href hanya bila path internal (satu "/" di depan, tanpa karakter kontrol, origin sama). */
export function safeInternalPath(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(href)) return null;
  try {
    const u = new URL(href, "http://x");
    if (u.origin !== "http://x") return null;
    // Return the normalised form (dot segments resolved); "/a/..//evil" normalises to "//evil" → protocol-relative.
    const out = u.pathname + u.search + u.hash;
    return out.startsWith("//") || out.startsWith("/\\") ? null : out;
  } catch {
    return null;
  }
}

/** Where sign-in lands: the deep link when it is an internal page (never /login or /api), otherwise Overview. */
export function afterSignIn(next: string | null | undefined): string {
  const p = next ? safeInternalPath(next) : null;
  return p && !/^\/(login|api)(\/|\?|$)/.test(p) ? p : "/";
}

/** Sign-in URL that returns to `current` (path + query) afterwards; plain /login when there is nothing to return to. */
export function signInHref(current: string | null | undefined): string {
  const target = afterSignIn(current);
  return target === "/" ? "/login" : `/login?next=${encodeURIComponent(target)}`;
}
