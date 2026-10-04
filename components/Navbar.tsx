"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/#about", label: "Sobre" },
  { href: "/#services", label: "Serviços" },
  { href: "/#process", label: "Como Funciona" },
];

const BOOKING_LINK = "/marcar-consulta";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("section[id]");

    function onScroll() {
      let current = "";
      sections.forEach((section) => {
        if (window.scrollY >= section.offsetTop - 100) current = section.id;
      });
      setActive(current);
    }

    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            Filipa Rebelo <span>Nutricionista</span>
          </Link>
          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={active === link.href.slice(2) ? "active" : ""}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={BOOKING_LINK} className="nav-cta">
                Marcar Consulta
              </Link>
            </li>
          </ul>
          <button className="hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>
      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link href={BOOKING_LINK} className="nav-cta" onClick={() => setMenuOpen(false)}>
          Marcar Consulta
        </Link>
      </div>
    </>
  );
}
