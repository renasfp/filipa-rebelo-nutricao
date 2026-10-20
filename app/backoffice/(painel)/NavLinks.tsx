"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function NavLinks({ links }: { links: { href: string; label: ReactNode }[] }) {
  const pathname = usePathname();
  return (
    <nav className="bo-nav" aria-label="Backoffice">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
