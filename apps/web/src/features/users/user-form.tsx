"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BlockedButton, ErrorSummary, Failure, Field, FormActions, FormSection, Notice, Panel, PasswordChecks, RadioGroup, RequiredNote, useForm,
} from "@starterkit/ui/ds";
import { rules, type Schema } from "@starterkit/ui/lib/validate";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { PasswordInput } from "@starterkit/ui/ui/password-input";
import { Reveal, useDelayedFlag } from "@starterkit/ui/motion";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { toast } from "@starterkit/ui/ui/toast";
import { DetailNotFound } from "@/components/detail-not-found";
import { LoadingShape } from "@/components/route-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { LazyConfirmActionDialog } from "@/components/lazy-confirm";
import { api, errorText, isNotFound } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { UserDetailDto, UserDto } from "@starterkit/shared/contracts/users";
import { BRAND } from "@starterkit/shared/brand";
import { rankBlock, USERS_KEY, useRoleNames, useUserDetail } from "./use-users";
import { useDebounced } from "@/lib/client/use-debounced";
import { useLeaveGuard } from "@/lib/client/use-leave-guard";
import { PASSWORD_MIN, passwordChecks } from "@/lib/shared/password";
import { EDIT_USER_SHAPE } from "./shapes";

const CHECK = "size-4 cursor-pointer accent-primary";

const CREATE = { title: "Create user", description: "Add an account and choose how it signs in." };
const EDIT = { title: "Edit user", description: "Change name, sign-in names, roles or status." };


/** /users/new: the page header and an empty form. */
export function CreateUser() {
  return <div className="grid gap-section"><PageHeader {...CREATE} /><UserForm /></div>;
}

type Method = "" | "password" | "invite" | "directory";
type Values = { name: string; username: string; email: string; method: Method; password: string };
const SCHEMA: Schema<Values> = {
  name: [rules.required("Enter a name."), rules.maxLength(100)],
  username: [rules.required("Enter a username."), rules.pattern(/^[a-zA-Z0-9._-]{3,32}$/, "Use 3–32 characters: letters, numbers, dot, dash or underscore.")],
  email: [rules.required("Enter an email address."), rules.email(), rules.maxLength(254)],
  // Only a new user signing in with a password has one here ("" on edit).
  password: [(v, x) => (x.method !== "password" ? null : !v ? "Enter a password." : String(v).length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : null)],
};
const LABELS = { name: "Name", username: "Username", email: "Email", password: "Password" };

/**
 * Create (no `user`) or edit one user, in sections (FormSection): profile, access, and for a new user the first
 * sign-in. LDAP users have no password or invite; the LDAP choice is fixed after creation.
 */
function UserForm({ user }: { user?: UserDetailDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me, perms } = useAuth();
  const [roleText, setRoleText] = useState("");
  const roleTerm = useDebounced(roleText.trim());
  const roleNames = useRoleNames(roleTerm);
  const f = useForm<Values>({
    initial: { name: user?.name ?? "", username: user?.username ?? "", email: user?.email ?? "", method: user ? "" : "password", password: "" },
    schema: SCHEMA, idPrefix: "u",
  });
  const [roles, setRoles] = useState<string[]>(user?.roles ?? ["Viewer"]);
  const [isActive, setActive] = useState(user?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const self = !!user && user.id === me.id;
  const { method } = f.values;
  // Same rank rule as the list and detail: fields stay readable, nothing can be changed or saved.
  const blocked = user ? rankBlock(user, perms) : null;
  // More roles than one page: type to search; the roles already picked stay listed first.
  const searchable = roleNames.more || roleTerm !== "";
  const shownRoles = searchable ? [...new Set([...roles, ...roleNames.names])] : roleNames.names;
  const toggleRole = (r: string) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  // Typed but not saved: a link click asks first (while saving, the form navigates away itself).
  const startRoles = user?.roles ?? ["Viewer"];
  const dirty = f.values.name !== (user?.name ?? "") || f.values.username !== (user?.username ?? "") || f.values.email !== (user?.email ?? "")
    || f.values.password !== "" || isActive !== (user?.isActive ?? true) || method !== (user ? "" : "password")
    || roles.length !== startRoles.length || roles.some((r) => !startRoles.includes(r));
  const guard = useLeaveGuard(dirty && !busy);

  const save = f.submit(async (v) => {
    if (blocked) return;
    setBusy(true);
    setError(null);
    const profile = { name: v.name.trim(), username: v.username.trim(), email: v.email.trim() };
    try {
      let id = user?.id;
      if (user) {
        await api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ ...profile, ...(self ? {} : { roles, isActive }) }) });
        toast(`Saved ${profile.name}.`);
      } else {
        const isLdap = v.method === "directory";
        const body = { ...profile, roles, isActive, isLdap, ...(isLdap ? {} : v.method === "invite" ? { invite: true } : { password: v.password }) };
        const created = await api<UserDto>("/api/users", { method: "POST", body: JSON.stringify(body) });
        toast(`Created ${created.name}.`, { description: v.method === "invite" ? `An invitation link was sent to ${created.email}. It works for 72 hours.` : undefined });
        id = created.id;
      }
      await qc.invalidateQueries({ queryKey: USERS_KEY });
      router.push(`/users/${id}`);
      // Your own name and email also show in the account menu, which the server layout renders.
      if (self) router.refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  });

  return (
    <Panel bodyClassName="md:p-6">
      {blocked && <div className="mb-4"><Notice>{blocked}</Notice></div>}
      <form noValidate onSubmit={save} aria-label={user ? "Edit user" : "New user"}>
        <fieldset disabled={!!blocked} className="contents">
          {f.submitted && <div className="mb-6"><ErrorSummary errors={f.shown} idPrefix="u" labels={LABELS} /></div>}
          <RequiredNote className="mb-6" />
          <FormSection title="Profile" description="How the user appears in lists and the activity log, and the names they sign in with.">
            <Field id={f.id("name")} label="Name" required error={f.error("name")}><Input {...f.text("name")} autoComplete="off" /></Field>
            <Field id={f.id("username")} label="Username" required note="3–32 characters: letters, numbers, dot, dash or underscore." error={f.error("username")}>
              <Input {...f.text("username")} autoComplete="off" spellCheck={false} autoCapitalize="none" className="font-mono" />
            </Field>
            <Field id={f.id("email")} label="Email" required error={f.error("email")}>
              <Input {...f.text("email")} type="email" autoComplete="off" spellCheck={false} autoCapitalize="none" />
            </Field>
          </FormSection>
          <FormSection title="Access" description="Roles decide what the user can open and change. An inactive user can't sign in.">
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-label text-fg">Roles</legend>
              {searchable && !self && (
                <Input aria-label="Search roles" type="search" value={roleText} onChange={(e) => setRoleText(e.target.value)} placeholder="Search role name" autoComplete="off" className="w-full max-w-64" />
              )}
              <Reveal loading={roleNames.query.isPending} skeleton={<Skeleton className="h-5 w-40" />}>
                {roleNames.query.error && !roleNames.query.data ? <Failure title="Couldn't load roles" error={roleNames.query.error} source={BRAND.name} onRetry={() => void roleNames.query.refetch()} /> : (
                  <div className="grid gap-2">
                    {shownRoles.map((r) => (
                      <label key={r} className="flex items-center gap-2 text-body text-fg">
                        <input type="checkbox" className={CHECK} checked={roles.includes(r)} disabled={self} onChange={() => toggleRole(r)} />{r}
                      </label>
                    ))}
                  </div>
                )}
              </Reveal>
              {self && <span className="text-caption text-fg-3">You can&apos;t change your own roles. Ask another administrator.</span>}
            </fieldset>
            <label className="flex items-center gap-2 text-body text-fg">
              <input type="checkbox" className={CHECK} checked={isActive} disabled={self}
                onChange={(e) => { setActive(e.target.checked); if (!e.target.checked && method === "invite") f.set("method", "password"); }} />Active
              {self && <span className="text-caption text-fg-3">You can&apos;t deactivate your own account.</span>}
            </label>
          </FormSection>
          {!user && (
            <FormSection title="First sign-in" description="How the user signs in the first time.">
              <RadioGroup name="u-method" legend="Sign-in method" required value={method} onChange={(m) => f.set("method", m)} options={[
                { value: "password", label: "Set a password now", description: "You set it here and give it to the user." },
                { value: "invite", label: "Send an invitation link", disabled: !isActive,
                  description: isActive ? "The user chooses a password. The link works for 72 hours." : "An inactive user can't use an invitation. Set the user active to send one." },
                { value: "directory", label: "Directory user", description: "Signs in with the directory password. No password or invitation is set here." },
              ]} />
              {method === "password" && (
                <div className="grid gap-2">
                  <Field id={f.id("password")} label="Password" required error={f.error("password")}>
                    <PasswordInput {...f.text("password")} maxLength={128} autoComplete="new-password" aria-describedby="u-password-checks" />
                  </Field>
                  <PasswordChecks id="u-password-checks" checks={passwordChecks(f.values.password)} />
                </div>
              )}
            </FormSection>
          )}
        </fieldset>
        {error && <p role="alert" className="mb-4 text-body-sm text-down-ink">{error}</p>}
        <FormActions className="md:-mx-6 md:-mb-6 md:px-6">
          <BlockedButton type="submit" reason={blocked} disabled={busy} aria-busy={busy || undefined}>{busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}{user ? "Save user" : "Create user"}</BlockedButton>
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>Cancel</Button>
        </FormActions>
      </form>
      {guard.leaving && (
        <LazyConfirmActionDialog open onOpenChange={(o) => { if (!o) guard.stay(); }} auditFields={false} reasons={[]} destructive title="Leave without saving"
          description={user ? `Your changes to ${user.name} aren't saved.` : "This user isn't created yet."}
          impact={["What you typed is discarded."]} actionLabel="Leave page" onConfirm={async () => guard.leave()} />
      )}
    </Panel>
  );
}

/** /users/[id]/edit: loads the user, then shows the form (keyed so it starts from the loaded values). */
export function EditUser({ id }: { id: string }) {
  const q = useUserDetail(id);
  // No flash: the loading shape appears after 150 ms and then stays at least 300 ms (it holds its place hidden before).
  const skeleton = useDelayedFlag(!q.data && !q.error);
  if (isNotFound(q.error)) return <DetailNotFound title={EDIT.title} noun="user" list={{ href: "/users", label: "Users" }} />;
  if (q.error && !q.data) return <div className="grid gap-section"><PageHeader {...EDIT} /><Panel><Failure title="Couldn't load this user" error={q.error} source={BRAND.name} onRetry={() => void q.refetch()} /></Panel></div>;
  if (!q.data || skeleton) return <LoadingShape sections={EDIT_USER_SHAPE} shown={skeleton} />;
  return <div className="grid gap-section"><PageHeader {...EDIT} trail={[{ label: q.data.name, href: `/users/${q.data.id}` }]} /><UserForm key={q.data.id} user={q.data} /></div>;
}
