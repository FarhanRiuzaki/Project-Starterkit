"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { ApiError, api } from "@/lib/client/api";
import { AuthCard, errorText, FormError } from "./auth-card";

type Mode = "totp" | "recovery";

/** Sign-in step 2: the 6-digit one-time code (submits itself at 6 digits) or a recovery code. */
export function TwoFactorForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // After a failed check, back to the (cleared) code field once it accepts input again.
  useEffect(() => { if (error && !busy) inputRef.current?.focus({ preventScroll: true }); }, [error, busy]);

  async function verify(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: string }>("/api/auth/2fa", { method: "POST", body: JSON.stringify({ code: value, next }) });
      router.replace(r.next);
      router.refresh();
    } catch (e) {
      setExpired(e instanceof ApiError && (e.status === 401 || e.status === 403));
      if (e instanceof ApiError && e.code === "invalid_code") setCode("");
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function startOver() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }

  function switchMode() {
    setMode(mode === "totp" ? "recovery" : "totp");
    setCode("");
    setError(null);
  }

  const errId = "two-factor-error";
  const helpId = "two-factor-help";
  const totp = mode === "totp";
  return (
    <AuthCard title="Two-factor authentication"
      description={totp ? "Enter the 6-digit code from your authenticator app." : "Enter one of the recovery codes you saved when you turned on two-factor authentication."}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void verify(code); }} className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="code" className="text-label text-fg">{totp ? "One-time code" : "Recovery code"}</label>
          <Input key={mode} ref={inputRef} id="code" className="h-10 font-mono tracking-widest tabular" autoFocus required
            inputMode={totp ? "numeric" : "text"} autoComplete={totp ? "one-time-code" : "off"} maxLength={totp ? 6 : 9}
            placeholder={totp ? undefined : "xxxx-xxxx"} value={code} readOnly={busy}
            aria-describedby={error ? `${errId} ${helpId}` : helpId} aria-invalid={error && !expired ? true : undefined}
            onChange={(e) => {
              const v = totp ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value;
              setCode(v);
              if (totp && v.length === 6) void verify(v);
            }} />
          <span id={helpId} className="text-caption text-fg-3">
            {totp ? "The code changes every 30 seconds." : "Each recovery code works once."}
          </span>
        </div>
        {error && <FormError id={errId} message={error} />}
        {expired ? (
          <Button type="button" size="lg" className="h-10 w-full" onClick={() => void startOver()}>Sign in again</Button>
        ) : (
          <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || (totp ? code.length !== 6 : code.trim().length < 6)}>
            {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Verify and sign in
          </Button>
        )}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Button type="button" variant="link" className="px-0" onClick={switchMode}>{totp ? "Use a recovery code" : "Use your authenticator app"}</Button>
        <Button type="button" variant="link" className="px-0 text-fg-2" onClick={() => void startOver()}>Use a different account</Button>
      </div>
    </AuthCard>
  );
}
