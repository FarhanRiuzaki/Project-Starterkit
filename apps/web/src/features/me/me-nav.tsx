"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RouteTabs } from "@starterkit/ui/ds/navigation";

const TABS = [
  { href: "/me", label: "Profile" },
  { href: "/me/security", label: "Security" },
  { href: "/me/sessions", label: "Sessions" },
] as const;

/** Links between the three own-account screens (the account menu has the same three). */
export function MeNav() {
  const path = usePathname();
  return (
    <RouteTabs aria-label="Account">
      {TABS.map((t) => (

          <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>

      ))}
    </RouteTabs>
  );
}
