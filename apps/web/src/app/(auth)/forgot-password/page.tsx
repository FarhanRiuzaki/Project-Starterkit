import type { Metadata } from "next";
import { ForgotForm } from "@/features/auth/forgot-form";

export const metadata: Metadata = { title: "Reset password · Starterkit" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
