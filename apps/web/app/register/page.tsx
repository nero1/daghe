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
