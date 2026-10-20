"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Notice } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { api, errorText } from "@/lib/client/api";
import { AuthCard, FormError } from "./auth-card";

const MIN = 12; // contracts/auth.ts Password (zod stays out of client code)

/** Set a new password from a reset link (`token` from the URL). */
export function ResetForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [field, setField] = useState<{ id: "password" | "confirm"; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const invalid = password.length < MIN ? { id: "password" as const, message: `Use at least ${MIN} characters.` }
      : confirm !== password ? { id: "confirm" as const, message: "The passwords don't match. Type the same password twice." } : null;
    if (invalid) {
      setField(invalid);
      document.getElementById(invalid.id)?.focus(); // the message under it is role=alert and is announced too
      return;
    }
    setField(null);
    setBusy(true);
    try {
      await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Set a new password">
        <FormError id="reset-error" message="This reset link is incomplete. Request a new link." />
        <Link href="/forgot-password" className="text-label text-primary-ink underline underline-offset-4 hover:decoration-2">Request a new link</Link>
      </AuthCard>
    );
  }
  if (done) {
    return (
      <AuthCard title="Password changed">
        <Notice live>Your new password is set, and other sessions of this account were signed out.</Notice>
        <Link href="/login" className="text-label text-primary-ink underline underline-offset-4 hover:decoration-2">Sign in</Link>
      </AuthCard>
    );
  }
  const fieldError = (id: "password" | "confirm") =>
    field?.id === id ? <span id={`${id}-error`} role="alert" className="text-caption text-down-ink">{field.message}</span> : null;
  return (
    <AuthCard title="Set a new password" description={`Use at least ${MIN} characters. The reset link works once.`}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-label text-fg">New password</label>
          <Input id="password" type="password" className="h-10" autoComplete="new-password" autoFocus required value={password}
            onChange={(e) => setPassword(e.target.value)} aria-invalid={field?.id === "password" ? true : undefined}
            aria-describedby={field?.id === "password" ? "password-error" : undefined} />
          {fieldError("password")}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="confirm" className="text-label text-fg">Confirm new password</label>
          <Input id="confirm" type="password" className="h-10" autoComplete="new-password" required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} aria-invalid={field?.id === "confirm" ? true : undefined}
            aria-describedby={field?.id === "confirm" ? "confirm-error" : undefined} />
          {fieldError("confirm")}
        </div>
        {error && <FormError id="reset-error" message={error} />}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
          {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Set new password
        </Button>
      </form>
      {error && <Link href="/forgot-password" className="text-label text-primary-ink underline underline-offset-4 hover:decoration-2">Request a new link</Link>}
    </AuthCard>
  );
}
