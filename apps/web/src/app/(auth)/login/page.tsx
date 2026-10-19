import type { Metadata } from "next";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LoginForm next={afterSignIn(typeof next === "string" ? next : null)} />;
}
