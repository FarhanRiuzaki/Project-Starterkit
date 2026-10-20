import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { afterSignIn, signInHref } from "@starterkit/ui/lib/safe-path";
import { TwoFactorForm } from "@/features/auth/two-factor-form";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Two-factor authentication" };

/**
 * Only reachable with a pending sign-in (password accepted, second factor due); otherwise back to sign-in. The API
 * knows when the challenge expires (10 minutes): a code sent after that is refused and the cookie cleared.
 */
export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const target = afterSignIn(typeof next === "string" ? next : null);
  if (!(await getSession()).challenge) redirect(signInHref(target));
  return <TwoFactorForm next={target} />;
}
