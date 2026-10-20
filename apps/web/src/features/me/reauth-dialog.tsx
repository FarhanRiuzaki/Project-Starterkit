"use client";

import { type FormEvent, useRef, useState } from "react";
import { Field } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@starterkit/ui/ui/dialog";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { api, errorText } from "@/lib/client/api";
import type { MeDto } from "@starterkit/shared/contracts/me";

/**
 * Proves the user again before connecting `provider` (POST /api/me/reauth), then goes on to the provider. The proof is
 * the password (the directory password for LDAP users), or a recovery code for an account without a password. Loaded
 * on click, so it stays out of the security page's first load.
 */
export function ReauthDialog({ user, provider, label, onCancel }: {
  user: MeDto; provider: string; label: string; onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = !user.hasPassword && !user.isLdap;
  const field = code ? "Recovery code" : user.isLdap ? "Directory password" : "Password";

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/reauth", { method: "POST", body: JSON.stringify(code ? { recoveryCode: proof } : { password: proof }) });
      // A route handler, not a page: a full navigation (it answers 303 to the provider). Stays busy while the browser leaves.
      window.location.assign(new URL(`/api/auth/oauth/${provider}?mode=link`, window.location.href));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent>
        <form onSubmit={confirm} noValidate>
          <DialogHeader>
            <DialogTitle>Connect {label}</DialogTitle>
            <DialogDescription>
              {code
                ? `Connecting ${label} adds a way to sign in. Enter one of your recovery codes to continue; it is used up.`
                : `Connecting ${label} adds a way to sign in. Enter your ${user.isLdap ? "directory password" : "password"} to continue.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5">
            <Field id="reauth-proof" label={field}>
              <Input ref={inputRef} id="reauth-proof" type={code ? "text" : "password"} autoComplete={code ? "one-time-code" : "current-password"} autoFocus
                value={proof} onChange={(e) => setProof(e.target.value)} aria-invalid={error ? true : undefined} aria-errormessage={error ? "reauth-error" : undefined} />
            </Field>
            {error && <p id="reauth-error" role="alert" className="text-body-sm text-down-ink">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !proof} aria-busy={busy || undefined}>
              {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Connect {label}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
