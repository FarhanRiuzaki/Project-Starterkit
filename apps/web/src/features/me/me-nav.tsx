"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@starterkit/ui/ui/button";

const TABS = [
  { href: "/me", label: "Profile" },
  { href: "/me/security", label: "Security" },
  { href: "/me/sessions", label: "Sessions" },
] as const;

/** Links between the three own-account screens (the account menu has the same three). */
export function MeNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="flex gap-1">
      {TABS.map((t) => (
        <Button key={t.href} asChild size="sm" variant={path === t.href ? "secondary" : "ghost"}>
          <Link href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
