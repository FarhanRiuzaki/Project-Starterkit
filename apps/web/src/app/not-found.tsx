import type { Metadata } from "next";
import { NotFoundCard } from "@/components/not-found-card";

export const metadata: Metadata = { title: "Page not found" };

/** Outside the shell: one flat card on the app background, the same composition as the sign-in card. */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <NotFoundCard />
    </main>
  );
}
