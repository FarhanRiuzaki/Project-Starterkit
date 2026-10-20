"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Failure, Field, Panel } from "@starterkit/ui/ds";
import { useDelayedFlag } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { IdentityIcon, SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { toast } from "@starterkit/ui/ui/toast";
import { LoadingShape } from "@/components/route-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import type { MeDto } from "@starterkit/shared/contracts/me";
import { BRAND } from "@/lib/shared/brand";
import { MeNav } from "./me-nav";
import { ME_KEY, useMe } from "./use-me";
import { PROFILE_SHAPE } from "./shapes";


/** /me: own name and email; the username is read-only (an administrator changes it). */
export function ProfilePage() {
  const q = useMe();
  // No flash: the loading shape appears after 150 ms and then stays at least 300 ms (it holds its place hidden before).
  const skeleton = useDelayedFlag(!q.data && !q.error);
  const header = <PageHeader title="Profile" description="Your name and email." actions={<MeNav />} />;
  if (q.error && !q.data) return <div className="grid gap-section">{header}<Panel><Failure title="Couldn't load your profile" error={q.error} source={BRAND.name} onRetry={() => void q.refetch()} /></Panel></div>;
  if (!q.data || skeleton) return <LoadingShape sections={PROFILE_SHAPE} shown={skeleton} />;
  return (
    <div className="grid gap-section">
      {header}
      <Panel icon={IdentityIcon} title="Profile" description="Shown to other users and in the activity log"><Form key={q.data.id} user={q.data} /></Panel>
    </div>
  );
}

function Form({ user }: { user: MeDto }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The email is the sign-in identity: a new one needs the current password (re-authentication); an account that
  // signs in only through Google or Apple keeps the provider's email.
  const providerEmail = !user.hasPassword && !user.isLdap;
  const emailChange = email.trim().toLowerCase() !== user.email.toLowerCase();
  const dirty = name.trim() !== user.name || email.trim() !== user.email;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await api<MeDto>("/api/me", { method: "PATCH", body: JSON.stringify({ name: name.trim(), email: email.trim(), ...(emailChange ? { currentPassword } : {}) }) });
      qc.setQueryData(ME_KEY, u);
      setCurrentPassword("");
      router.refresh(); // the account menu reads the user from the layout
      toast("Profile saved.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-md gap-4">
      <Field id="me-name" label="Name"><Input id="me-name" value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
      <Field id="me-email" label="Email" note={providerEmail ? "Your email comes from your connected Google or Apple account." : undefined}>
        <Input id="me-email" type="email" value={email} maxLength={254} required readOnly={providerEmail} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      {emailChange && (
        <Field id="me-email-pw" label={user.isLdap ? "Directory password" : "Current password"} note="Needed to change the email you sign in with.">
          <Input id="me-email-pw" type="password" value={currentPassword} required onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </Field>
      )}
      <Field id="me-username" label="Username" note="You can't change your username. Ask an administrator.">
        <Input id="me-username" value={user.username} readOnly />
      </Field>
      {error && <p role="alert" className="text-body-sm text-down-ink">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !dirty}>{busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Save profile</Button>
        {!dirty && <span className="text-caption text-fg-3">Change a field to save.</span>}
      </div>
    </form>
  );
}
