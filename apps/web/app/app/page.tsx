"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readCases } from "@/lib/cases";
import { strings, type Lang, getSavedLang, saveLang, getAvailableLanguages } from "@/lib/i18n";
import { ensureCsrfToken } from "@/lib/csrf";
import { hasConsented } from "@/lib/onboarding";

export default function AppHomePage() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [unsynced, setUnsynced] = useState(0);
  const [lang, setLang] = useState<Lang>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt(): Promise<void> } | null>(null);

  useEffect(() => {
    if (!hasConsented()) { router.replace("/onboarding"); return; }
    setLang(getSavedLang());
    setOnline(navigator.onLine);
    readCases().then((rows) => setUnsynced(rows.filter((c) => c.syncStatus !== "synced").length));
    const onStatus = () => setOnline(navigator.onLine);
    window.addEventListener("online", onStatus);
    window.addEventListener("offline", onStatus);
    const onInstall = (e: Event) => { e.preventDefault(); setInstallPrompt(e as Event & { prompt(): Promise<void> }); };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("online", onStatus);
      window.removeEventListener("offline", onStatus);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, [router]);

  async function login() {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ email, password }) });
    setMessage(r.ok ? "Login successful." : "Login failed.");
  }
  async function doRefreshSession() {
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", headers: { "x-csrf-token": csrf } });
    setMessage(r.ok ? "Session refreshed." : "Refresh failed.");
  }
  async function logout() {
    const csrf = await ensureCsrfToken();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: { "x-csrf-token": csrf } });
    setMessage("Logged out.");
  }

  const t = strings[lang];

  return (
    <main className="login-page">
      <div className="login-header">
        <h1 className="login-welcome">{t.welcomeTitle}</h1>
        <div className="login-lang-row">
          <label htmlFor="app-lang">{t.language}</label>
          <select
            id="app-lang"
            value={lang}
            onChange={(e) => { const l = e.target.value as Lang; setLang(l); saveLang(l); }}
          >
            {getAvailableLanguages().map(({ code, name }) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        <p className="login-status">
          <span className={`status-dot ${online ? "status-dot--online" : "status-dot--offline"}`} />
          {t.status}: {online ? t.online : t.offline}
          {unsynced > 0 && <span className="login-unsynced"> · {t.unsynced}: {unsynced}</span>}
        </p>
      </div>

      <section className="login-card">
        <h2 className="login-card-title">{t.chwSignIn}</h2>
        <div className="login-field">
          <label htmlFor="login-email">{t.emailLabel}</label>
          <input
            id="login-email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />
        </div>
        <div className="login-field">
          <label htmlFor="login-password">{t.passwordLabel}</label>
          <input
            id="login-password"
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="login-actions">
          <button className="login-btn-primary" onClick={login}>{t.loginBtn}</button>
          <div className="login-secondary-row">
            <button className="login-btn-secondary" onClick={doRefreshSession}>{t.refreshSession}</button>
            <button className="login-btn-secondary" onClick={logout}>{t.logoutBtn}</button>
          </div>
        </div>
        {message && <p className="login-message">{message}</p>}
      </section>

      {installPrompt && (
        <button
          className="login-btn-primary"
          onClick={() => { installPrompt.prompt(); setInstallPrompt(null); }}
        >
          {t.installApp}
        </button>
      )}

      <nav className="login-nav">
        <Link href="/triage" className="login-nav-link">{t.triage}</Link>
        <Link href="/cases" className="login-nav-link">{t.cases}</Link>
        <Link href="/dashboard" className="login-nav-link">{t.dashboard}</Link>
        {online && <Link href="/admin" className="login-nav-link">{t.adminTitle}</Link>}
      </nav>

      <p className="login-register">
        <Link href="/register">{t.registerTitle}</Link>
      </p>
    </main>
  );
}
