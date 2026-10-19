"use client";

import { type FormEvent, useState } from "react";
import { CopyValue, QrCode } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@starterkit/ui/ui/dialog";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { ApiError, api, errorText } from "@/lib/client/api";
import type { RecoveryCodesDto, TwoFactorSetupDto } from "@/lib/shared/contracts/me";

/** Step 2 of turning on two-factor authentication: scan the QR code, enter the first code. The secret lives in state only. */
export function TwoFactorSetup({ setup, onCancel, onDone }: {
  setup: TwoFactorSetupDto; onCancel: () => void; onDone: (recoveryCodes: string[]) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<RecoveryCodesDto>("/api/me/2fa", { method: "PUT", body: JSON.stringify({ code }) });
      onDone(r.recoveryCodes);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_code") setCode("");
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent>
        <form onSubmit={confirm} noValidate>
          <DialogHeader>
            <DialogTitle>Turn on two-factor authentication</DialogTitle>
            <DialogDescription>Scan the QR code with an authenticator app, then enter the 6-digit code it shows.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5">
            <QrCode value={setup.otpauthUrl} label="QR code for your authenticator app" className="mx-auto size-44" />
            <div className="grid gap-1">
              <span className="text-body-sm text-fg-3">Can&apos;t scan? Enter this key in the app.</span>
              <CopyValue value={setup.secret} label="setup key" />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="tf-code" className="text-label text-fg">One-time code</label>
              <Input id="tf-code" className="font-mono tracking-widest tabular" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-invalid={error ? true : undefined} aria-describedby={error ? "tf-error" : undefined} />
            </div>
            {error && <p id="tf-error" role="alert" className="text-body-sm text-down-ink">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || code.length !== 6}>{busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Verify and turn on</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
