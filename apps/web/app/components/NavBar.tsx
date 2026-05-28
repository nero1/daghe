"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { strings, type Lang, getSavedLang } from "@/lib/i18n";

function getSavedTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (window.localStorage.getItem("asibi_theme") as "light" | "dark") ?? "light";
}

function saveTheme(theme: "light" | "dark") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("asibi_theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new CustomEvent("asibi:themechange", { detail: theme }));
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setLang(getSavedLang());
    setOnline(navigator.onLine);
    const savedTheme = getSavedTheme();
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    const onLangChange = () => setLang(getSavedLang());
    const onStatus = () => setOnline(navigator.onLine);
    const onThemeChange = (e: Event) => {
      const t = (e as CustomEvent<"light" | "dark">).detail;
      setTheme(t);
      document.documentElement.setAttribute("data-theme", t);
    };

    window.addEventListener("asibi:langchange", onLangChange);
    window.addEventListener("storage", onLangChange);
    window.addEventListener("online", onStatus);
    window.addEventListener("offline", onStatus);
    window.addEventListener("asibi:themechange", onThemeChange);
    return () => {
      window.removeEventListener("asibi:langchange", onLangChange);
      window.removeEventListener("storage", onLangChange);
      window.removeEventListener("online", onStatus);
      window.removeEventListener("offline", onStatus);
      window.removeEventListener("asibi:themechange", onThemeChange);
    };
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    saveTheme(next);
  }

  // Hide on landing page — it has its own header
  if (pathname === "/") return null;

  const t = strings[lang];

  const links: { href: "/app" | "/triage" | "/cases" | "/dashboard" | "/help"; label: string }[] = [
    { href: "/app", label: t.title },
    { href: "/triage", label: t.triage },
    { href: "/cases", label: t.cases },
    { href: "/dashboard", label: t.dashboard },
    { href: "/help", label: t.helpTitle },
  ];

  const themeBtn = (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">Asibi</Link>

        <div className="navbar-status">
          <span className={`status-dot ${online ? "status-dot--online" : "status-dot--offline"}`} />
          <span className="status-label">{online ? t.online : t.offline}</span>
        </div>

        {/* Theme toggle: visible on mobile before hamburger */}
        <span className="theme-toggle-wrap theme-toggle-wrap--mobile">{themeBtn}</span>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen((m) => !m)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <span className={`hamburger ${menuOpen ? "hamburger--open" : ""}`} />
        </button>

        <nav className={`navbar-links${menuOpen ? " navbar-links--open" : ""}`} aria-label="Main navigation">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`navbar-link${pathname === href || (href !== "/app" && pathname.startsWith(href)) ? " navbar-link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          {/* Theme toggle: visible on desktop after last menu item */}
          <span className="theme-toggle-wrap theme-toggle-wrap--desktop">{themeBtn}</span>
        </nav>
      </div>
    </header>
  );
}
