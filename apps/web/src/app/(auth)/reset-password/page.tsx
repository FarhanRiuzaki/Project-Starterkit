import type { Metadata } from "next";
import { ResetForm } from "@/features/auth/reset-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === "string" ? token : null} />;
}
