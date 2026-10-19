"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Failure, Field, Panel } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { IdentityIcon, SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { api, errorText } from "@/lib/client/api";
import type { UserDto } from "@/lib/shared/contracts/users";
import { ME_KEY, useMe } from "./use-me";

/** Own name and email; the username is read-only (an administrator changes it). */
export function ProfileForm() {
  const q = useMe();
  if (q.error && !q.data) return <Panel><Failure title="Couldn't load your profile" error={q.error} source="Starterkit" onRetry={() => void q.refetch()} /></Panel>;
  return (
    <Panel icon={IdentityIcon} title="Profile" description="Shown to other users and in the activity log">
      {q.data ? <Form key={q.data.id} user={q.data} /> : (
        <div className="grid max-w-md gap-4" aria-busy="true"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
      )}
    </Panel>
  );
}

function Form({ user }: { user: UserDto }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = name.trim() !== user.name || email.trim() !== user.email;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const u = await api<UserDto>("/api/me", { method: "PATCH", body: JSON.stringify({ name: name.trim(), email: email.trim() }) });
      qc.setQueryData(ME_KEY, u);
      router.refresh(); // the account menu reads the user from the layout
      setMsg({ ok: true, text: "Profile saved." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-md gap-4">
      <Field id="me-name" label="Name"><Input id="me-name" value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
      <Field id="me-email" label="Email"><Input id="me-email" type="email" value={email} maxLength={254} required onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <Field id="me-username" label="Username" note="You can't change your username. Ask an administrator.">
        <Input id="me-username" value={user.username} readOnly aria-describedby="me-username-note" />
      </Field>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-body-sm text-healthy-ink" : "text-body-sm text-down-ink"}>{msg.text}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !dirty}>{busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Save profile</Button>
        {!dirty && <span className="text-caption text-fg-3">Change a field to save.</span>}
      </div>
    </form>
  );
}
