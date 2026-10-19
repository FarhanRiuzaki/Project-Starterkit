"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Notice } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { api } from "@/lib/client/api";
import { AuthCard, errorText, FormError } from "./auth-card";

/** Request a reset link. The answer is the same for every email, so the page never says whether an account exists. */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const errId = "forgot-error";
  return (
    <AuthCard title="Reset your password" description="Enter the email of your account. A link to set a new password goes to that address.">
      {sent ? (
        <Notice live>
          If an account uses {email}, a reset link is on its way. The link works for 30 minutes. In this demo no email
          is sent: the link is written to the server log.
        </Notice>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="email" className="text-label text-fg">Email</label>
            <Input id="email" type="email" className="h-10" autoComplete="email" autoFocus required value={email}
              onChange={(e) => setEmail(e.target.value)} aria-describedby={error ? errId : undefined} />
            <span className="text-caption text-fg-3">Users who sign in with LDAP change their password in the directory.</span>
          </div>
          {error && <FormError id={errId} message={error} />}
          <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
            {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Send reset link
          </Button>
        </form>
      )}
      <Link href="/login" className="text-label text-primary-ink hover:underline">Back to sign in</Link>
    </AuthCard>
  );
}
