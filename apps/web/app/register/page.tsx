"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSavedLang, strings } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const lang = getSavedLang();
  const t = strings[lang];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clinicCode, setClinicCode] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || password.length < 8) return;
    setSubmitting(true);
    setMessage("");
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password, clinic_code: clinicCode || undefined }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setMessage(body?.error?.message ?? t.registerError);
        return;
      }
      setSuccess(true);
      setMessage(t.registerSuccess);
      setTimeout(() => router.push("/"), 3000);
    } catch {
      setMessage(t.registerError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <h1>{t.registerTitle}</h1>

      {/* Google OAuth — primary sign-in method per PRD */}
      <section className="card" style={{ marginBottom: "1rem" }}>
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
        <p style={{ textAlign: "center", color: "#9ca3af", margin: "12px 0 0", fontSize: "0.875rem" }}>or use email below</p>
      </section>

      <section className="card">
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div>
              <label>{t.registerName}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={success} />
            </div>
            <div>
              <label>{t.adminUserEmail}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={success} />
            </div>
            <div>
              <label>{t.adminUserPassword} (min 8 characters)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required disabled={success} />
            </div>
            <div>
              <label>{t.adminUserClinic}</label>
              <input type="text" value={clinicCode} onChange={(e) => setClinicCode(e.target.value)} placeholder="Optional" disabled={success} />
            </div>
          </div>
          {message && (
            <p style={{ marginTop: "0.75rem", color: success ? "#2e7d32" : "red" }}>{message}</p>
          )}
          <div className="actions" style={{ marginTop: "1rem" }}>
            <Link href="/app">{t.back}</Link>
            <button type="submit" className="btn-primary" disabled={submitting || success}>
              {submitting ? "…" : t.registerTitle}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
