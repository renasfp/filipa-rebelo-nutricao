"use client";

import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "#about", label: "Sobre" },
  { href: "#services", label: "Serviços" },
  { href: "#process", label: "Como Funciona" },
];

const BOOKING_LINK = "https://nutrium.com/p/filiparebelo4499/schedule";

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
          <a href="#" className="nav-logo">
            Filipa Rebelo <span>Nutricionista</span>
          </a>
          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={active === link.href.slice(1) ? "active" : ""}>
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href={BOOKING_LINK} target="_blank" rel="noreferrer" className="nav-cta">
                Marcar Consulta
              </a>
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
          <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
            {link.label}
          </a>
        ))}
        <a href={BOOKING_LINK} target="_blank" rel="noreferrer" className="nav-cta">
          Marcar Consulta
        </a>
      </div>
    </>
  );
}
