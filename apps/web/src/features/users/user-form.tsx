"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Failure, Field, Panel } from "@starterkit/ui/ds";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SpinnerIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { Reveal, useDelayedFlag } from "@starterkit/ui/motion";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { toast } from "@starterkit/ui/ui/toast";
import { DetailNotFound } from "@/components/detail-not-found";
import { LoadingShape } from "@/components/route-skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText, isNotFound } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { UserDto } from "@/lib/shared/contracts/users";
import { BRAND } from "@/lib/shared/brand";
import { USERS_KEY, useRoleNames, useUserDetail } from "./use-users";
import { useDebounced } from "@/lib/client/use-debounced";
import { EDIT_USER_SHAPE } from "./shapes";

const CHECK = "size-4 cursor-pointer accent-primary";

const CREATE = { title: "Create user", description: "Add an account and choose how it signs in." };
const EDIT = { title: "Edit user", description: "Change name, sign-in names, roles or status." };


/** /users/new: the page header and an empty form. */
export function CreateUser() {
  return <div className="grid gap-section"><PageHeader {...CREATE} /><UserForm /></div>;
}

/** Create (no `user`) or edit one user. LDAP users have no password or invite; the LDAP choice is fixed after creation. */
function UserForm({ user }: { user?: UserDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [roleText, setRoleText] = useState("");
  const roleTerm = useDebounced(roleText.trim());
  const roleNames = useRoleNames(roleTerm);
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roles, setRoles] = useState<string[]>(user?.roles ?? ["Viewer"]);
  const [isActive, setActive] = useState(user?.isActive ?? true);
  const [isLdap, setLdap] = useState(user?.isLdap ?? false);
  const [how, setHow] = useState<"password" | "invite">("password");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const self = !!user && user.id === me.id;
  // More roles than one page: type to search; the roles already picked stay listed first.
  const searchable = roleNames.more || roleTerm !== "";
  const shownRoles = searchable ? [...new Set([...roles, ...roleNames.names])] : roleNames.names;
  const toggleRole = (r: string) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let id = user?.id;
      if (user) {
        await api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), username: username.trim(), email: email.trim(), ...(self ? {} : { roles, isActive }) }) });
        toast(`Saved ${name.trim()}.`);
      } else {
        const body = { name: name.trim(), username: username.trim(), email: email.trim(), roles, isActive, isLdap, ...(isLdap ? {} : how === "invite" ? { invite: true } : { password }) };
        const created = await api<UserDto>("/api/users", { method: "POST", body: JSON.stringify(body) });
        toast(`Created ${created.name}.`, { description: !isLdap && how === "invite" ? "The set-password link was written to the server log (mock email)." : undefined });
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
  }

  return (
    <Panel icon={UsersIcon} title={user ? "Edit user" : "New user"} description={user ? "Name, sign-in names, roles and status" : "They sign in with the method you choose below"}>
      <form onSubmit={save} className="grid max-w-md gap-4">
        <Field id="u-name" label="Name"><Input id="u-name" value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
        <Field id="u-username" label="Username" note="3–32 characters: letters, numbers, dot, dash or underscore.">
          <Input id="u-username" value={username} minLength={3} maxLength={32} pattern="[a-zA-Z0-9._\-]+" required onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="font-mono" />
        </Field>
        <Field id="u-email" label="Email"><Input id="u-email" type="email" value={email} maxLength={254} required onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></Field>
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
          <input type="checkbox" className={CHECK} checked={isActive} disabled={self} onChange={(e) => setActive(e.target.checked)} />Active
          {self && <span className="text-caption text-fg-3">You can&apos;t deactivate your own account.</span>}
        </label>
        {!user && (
          <>
            <label className="flex items-start gap-2 text-body text-fg">
              <input type="checkbox" className={`${CHECK} mt-0.5`} checked={isLdap} onChange={(e) => setLdap(e.target.checked)} aria-describedby="u-ldap-note" />
              <span className="grid"><span>Directory user</span><span id="u-ldap-note" className="text-caption text-fg-3">Signs in with the directory password. No password or invitation is set here.</span></span>
            </label>
            {!isLdap && (
              <fieldset className="grid gap-2">
                <legend className="mb-1.5 text-label text-fg">First sign-in</legend>
                <label className="flex items-center gap-2 text-body text-fg"><input type="radio" name="how" className={CHECK} checked={how === "password"} onChange={() => setHow("password")} />Set a password now</label>
                <label className="flex items-center gap-2 text-body text-fg"><input type="radio" name="how" className={CHECK} checked={how === "invite"} onChange={() => setHow("invite")} />Send an invitation link (valid 72 hours)</label>
                {how === "password" && (
                  <Field id="u-password" label="Password" note="At least 12 characters.">
                    <Input id="u-password" type="password" value={password} minLength={12} maxLength={128} required onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  </Field>
                )}
              </fieldset>
            )}
          </>
        )}
        {error && <p role="alert" className="text-body-sm text-down-ink">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}{user ? "Save user" : "Create user"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>Cancel</Button>
        </div>
      </form>
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
  return <div className="grid gap-section"><PageHeader {...EDIT} /><UserForm key={q.data.id} user={q.data} /></div>;
}
