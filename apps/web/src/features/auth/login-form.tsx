"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { BlockedButton, Segmented } from "@starterkit/ui/ds";
import { Button, buttonVariants } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { SecureIcon, SpinnerIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { PasswordInput } from "@starterkit/ui/ui/password-input";
import { api, errorText } from "@/lib/client/api";
import type { LoginResult } from "@starterkit/shared/contracts/auth";
import type { ConnectionProvider } from "@starterkit/shared/contracts/me";
import { AuthCard, FormError } from "./auth-card";

type Method = "password" | "ldap";
const METHODS = [{ value: "password", label: "Password" }, { value: "ldap", label: "LDAP" }] as const;
const PROVIDERS = [{ id: "google", label: "Google" }, { id: "apple", label: "Apple" }] as const;

/**
 * Sign in with email or username + password (or LDAP directory password), or a connected Google / Apple account
 * (`providers`: the ones the server has set up; the others stay visible, blocked with the reason). `error`: a
 * message to show first (a provider sign-in that came back failed); its `?error=` is then dropped from the URL.
 */
export function LoginForm({ next, providers, error: initialError = null }: { next: string; providers: Record<ConnectionProvider, boolean>; error?: string | null }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("password");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const back = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  // Shown once: the `?error=` goes from the URL (no new history entry), so a reload doesn't repeat it.
  useEffect(() => {
    if (initialError) router.replace(`/login${back}`, { scroll: false });
  }, [initialError, back, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<LoginResult>("/api/auth/login", { method: "POST", body: JSON.stringify({ method, login, password, next }) });
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const errId = "login-error";
  const described = error ? { "aria-describedby": errId } : {};
  return (
    <AuthCard title="Sign in" description={method === "ldap" ? "Use your directory username and password." : "Use your email or username and password."}>
      <form onSubmit={submit} className="grid gap-4">
        <Segmented label="Sign-in method" value={method} options={METHODS} onChange={(m) => { setMethod(m); setError(null); }} />
        <div className="grid gap-1.5">
          <label htmlFor="login" className="text-label text-fg">{method === "ldap" ? "Directory username" : "Email or username"}</label>
          <Input id="login" className="h-10" autoComplete="username" autoFocus required value={login} onChange={(e) => setLogin(e.target.value)} {...described} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-baseline">
            <label htmlFor="password" className="text-label text-fg">{method === "ldap" ? "Directory password" : "Password"}</label>
            {method === "password" && <Link href="/forgot-password" className="ml-auto text-label text-primary-ink underline underline-offset-4 hover:decoration-2">Forgot password?</Link>}
          </div>
          <PasswordInput id="password" className="h-10" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} {...described} />
        </div>
        {error && <FormError id={errId} message={error} />}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
          {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}Sign in
        </Button>
      </form>
      <div className="grid gap-2">
        <p className="flex items-center gap-3 text-caption text-fg-3 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or</p>
        {PROVIDERS.map((p) => (providers[p.id]
          ? <a key={p.id} href={`/api/auth/oauth/${p.id}${back}`} className={buttonVariants({ variant: "secondary", size: "lg", className: "h-10 w-full" })}>
              Continue with {p.label}
            </a>
          : <BlockedButton key={p.id} variant="secondary" size="lg" className="h-10 w-full" wrapClassName="w-full" reason={`${p.label} sign-in isn't set up on this server. Sign in another way.`}>
              Continue with {p.label}
            </BlockedButton>))}
      </div>
      <p className="flex items-center gap-1.5 border-t border-line pt-4 text-caption text-fg-3">
        <Icon icon={SecureIcon} className="size-3.5 shrink-0" />Every sign-in is logged.
      </p>
    </AuthCard>
  );
}
