"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Failure, Field, FormActions, FormSection, Panel, RequiredNote, useForm } from "@starterkit/ui/ds";
import { rules } from "@starterkit/ui/lib/validate";
import { useDelayedFlag } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { PasswordInput } from "@starterkit/ui/ui/password-input";
import { toast } from "@starterkit/ui/ui/toast";
import { LoadingShape } from "@/components/route-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { LazyConfirmActionDialog } from "@/components/lazy-confirm";
import { api, errorText } from "@/lib/client/api";
import { useLeaveGuard } from "@/lib/client/use-leave-guard";
import type { MeDto } from "@starterkit/shared/contracts/me";
import { BRAND } from "@starterkit/shared/brand";
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
      <Panel bodyClassName="md:p-6"><Form key={q.data.id} user={q.data} /></Panel>
    </div>
  );
}

const SCHEMA = {
  name: [rules.required("Enter your name."), rules.maxLength(100)],
  email: [rules.required("Enter your email address."), rules.email(), rules.maxLength(254)],
};

function Form({ user }: { user: MeDto }) {
  const qc = useQueryClient();
  const router = useRouter();
  const f = useForm({ initial: { name: user.name, email: user.email }, schema: SCHEMA, idPrefix: "me" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The email is the sign-in identity: a new one needs the current password (re-authentication); an account that
  // signs in only through Google or Apple keeps the provider's email.
  const providerEmail = !user.hasPassword && !user.isLdap;
  const emailChange = f.values.email.trim().toLowerCase() !== user.email.toLowerCase();
  const dirty = f.values.name.trim() !== user.name || f.values.email.trim() !== user.email;
  // Unsaved edits: a link click (the Security and Sessions tabs too) asks first.
  const guard = useLeaveGuard(dirty && !busy);
  const pwLabel = user.isLdap ? "Directory password" : "Current password";

  const save = f.submit(async ({ name, email }) => {
    if (emailChange && !currentPassword) { setPwError(true); document.getElementById("me-email-pw")?.focus(); return; }
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
  });

  return (
    <form noValidate onSubmit={save}>
      <RequiredNote className="mb-6" />
      <FormSection title="Your details" description="Shown to other users and in the activity log. Your email is also the address you sign in with.">
        <Field id={f.id("name")} label="Name" required error={f.error("name")}><Input {...f.text("name")} autoComplete="name" /></Field>
        <Field id={f.id("email")} label="Email" required error={f.error("email")} note={providerEmail ? "Your email comes from your connected Google or Apple account." : undefined}>
          <Input {...f.text("email")} type="email" readOnly={providerEmail} autoComplete="email" spellCheck={false} autoCapitalize="none" />
        </Field>
        {emailChange && (
          <Field id="me-email-pw" label={pwLabel} required note="Needed to change the email you sign in with." error={pwError && !currentPassword ? `Enter your ${pwLabel.toLowerCase()}.` : null}>
            <PasswordInput id="me-email-pw" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </Field>
        )}
        <Field id="me-username" label="Username" note="You can't change your username. Ask an administrator.">
          <Input id="me-username" value={user.username} readOnly />
        </Field>
      </FormSection>
      {error && <p role="alert" className="mb-4 text-body-sm text-down-ink">{error}</p>}
      <FormActions className="md:-mx-6 md:-mb-6 md:px-6">
        <Button type="submit" disabled={busy || !dirty} aria-busy={busy || undefined}>{busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Save profile</Button>
        {!dirty && <span className="text-caption text-fg-3">Change a field to save.</span>}
      </FormActions>
      {guard.leaving && (
        <LazyConfirmActionDialog open onOpenChange={(o) => { if (!o) guard.stay(); }} auditFields={false} reasons={[]} destructive title="Leave without saving"
          description="Your profile changes aren't saved." impact={["What you typed is discarded."]} actionLabel="Leave page" onConfirm={async () => guard.leave()} />
      )}
    </form>
  );
}
