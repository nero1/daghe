"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUnsyncedEncounters } from "@/lib/encounters";
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
    getUnsyncedEncounters().then((rows) => setUnsynced(rows.length));
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

      {/* Google OAuth — primary sign-in method per PRD */}
      <section className="login-card" style={{ marginBottom: "0.75rem" }}>
        <a
          href="/api/auth/google"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "12px",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "1rem",
            color: "#374151",
            textDecoration: "none",
            minHeight: 44,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </a>
        <p style={{ textAlign: "center", color: "#9ca3af", margin: "10px 0 0", fontSize: "0.85rem" }}>or use email & password</p>
      </section>

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
        <Link href="/screening" className="login-nav-link">Screening</Link>
        <Link href="/encounters" className="login-nav-link">{t.cases}</Link>
        <Link href="/dashboard" className="login-nav-link">{t.dashboard}</Link>
        {online && <Link href="/admin" className="login-nav-link">{t.adminTitle}</Link>}
      </nav>

      <p className="login-register">
        <Link href="/register">{t.registerTitle}</Link>
      </p>
    </main>
  );
}
