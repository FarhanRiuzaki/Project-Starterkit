import type { Metadata } from "next";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { LoginForm } from "@/features/auth/login-form";
import { oauthProviders } from "@/lib/server/oauth";

export const metadata: Metadata = { title: "Sign in" };

/** `?error=` set by the Google/Apple callback (apps/web/src/app/api/auth/oauth/[provider]/callback). */
const ERRORS: Record<string, string> = {
  oauth: "Google or Apple sign-in didn't complete. The account isn't connected to a user here, or the sign-in was canceled or took longer than 10 minutes. Try again, or sign in another way and connect the account under Security in your profile.",
  inactive: "This account is inactive. Ask an administrator to reactivate it.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  const { next, error } = await searchParams;
  return (
    <LoginForm next={afterSignIn(typeof next === "string" ? next : null)} providers={await oauthProviders()}
      error={typeof error === "string" ? (ERRORS[error] ?? null) : null} />
  );
}
