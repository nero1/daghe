"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { strings, type Lang, getSavedLang, saveLang, getAvailableLanguages } from "@/lib/i18n";

export default function AboutPage() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => { setLang(getSavedLang()); }, []);

  function changeLang(l: Lang) { setLang(l); saveLang(l); }

  const t = strings[lang];

  const modules = [
    { name: "Cervical Cancer Screening (VIA)", status: "v1.0 — available now", color: "#16A34A" },
    { name: "Chest X-ray (TB screening)", status: "planned", color: "#6B7280" },
    { name: "Skin lesion & wound assessment", status: "planned", color: "#6B7280" },
    { name: "Retinal / eye screening", status: "planned", color: "#6B7280" },
    { name: "Malaria slide reading", status: "planned", color: "#6B7280" },
    { name: "CT scan interpretation", status: "planned", color: "#6B7280" },
    { name: "MRI scan interpretation", status: "planned", color: "#6B7280" },
    { name: "General X-ray interpretation", status: "planned", color: "#6B7280" },
    { name: "Ultrasound interpretation", status: "planned", color: "#6B7280" },
  ];

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: ".75rem", marginBottom: "2rem" }}>
        <Link href="/" style={{ color: "#2563eb", textDecoration: "none", fontSize: ".9rem" }}>← Back</Link>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".85rem" }}>
          <label htmlFor="about-lang" style={{ margin: 0, color: "#6B7280" }}>{t.language}</label>
          <select
            id="about-lang"
            value={lang}
            onChange={(e) => changeLang(e.target.value as Lang)}
            style={{ fontSize: ".85rem", padding: ".25rem .5rem", width: "auto" }}
          >
            {getAvailableLanguages().map(({ code, name }) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-.03em", color: "#0f172a", marginBottom: ".5rem" }}>
          {t.aboutPageTitle}
        </h1>
        <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1e3a5f", marginBottom: "1rem" }}>
          {t.aboutPlatformTitle}
        </p>
        <p style={{ fontSize: "1rem", color: "#374151", lineHeight: 1.7 }}>
          {t.aboutPlatformDesc}
        </p>
      </div>

      {/* Mission */}
      <section style={{ background: "#1e3a5f", color: "#fff", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: ".5rem", opacity: .7, textTransform: "uppercase", letterSpacing: ".05em" }}>
          {t.aboutMissionTitle}
        </h2>
        <p style={{ fontSize: "1.05rem", lineHeight: 1.6, margin: 0 }}>{t.aboutMissionDesc}</p>
      </section>

      {/* Modalities */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", marginBottom: "1rem" }}>
          {t.aboutModulesTitle}
        </h2>
        <p style={{ fontSize: ".9rem", color: "#6B7280", marginBottom: "1rem" }}>{t.aboutModulesDesc}</p>
        <div style={{ display: "grid", gap: ".5rem" }}>
          {modules.map(({ name, status, color }) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".75rem 1rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: ".9rem", fontWeight: 500, color: "#1e293b" }}>{name}</span>
              <span style={{ fontSize: ".75rem", fontWeight: 700, color, background: color + "18", padding: ".2rem .6rem", borderRadius: "2rem" }}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", marginBottom: ".5rem" }}>
          {t.aboutPrivacyTitle}
        </h2>
        <p style={{ fontSize: ".95rem", color: "#374151", lineHeight: 1.7 }}>{t.aboutPrivacyDesc}</p>
      </section>

      {/* Technology */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", marginBottom: ".5rem" }}>
          {t.aboutTechTitle}
        </h2>
        <p style={{ fontSize: ".95rem", color: "#374151", lineHeight: 1.7 }}>{t.aboutTechDesc}</p>
      </section>

      {/* Languages */}
      <section style={{ background: "#f0fdf4", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#166534", marginBottom: ".4rem" }}>{t.aboutLangTitle}</h2>
        <p style={{ fontSize: ".875rem", color: "#374151", margin: 0 }}>{t.aboutLangDesc}</p>
      </section>

      {/* Footer links */}
      <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
        <Link href="/help" style={{ color: "#2563eb", textDecoration: "none", fontSize: ".9rem", fontWeight: 500 }}>
          Help & User Guide →
        </Link>
        <Link href="/app" style={{ color: "#2563eb", textDecoration: "none", fontSize: ".9rem", fontWeight: 500 }}>
          Open App →
        </Link>
      </div>
    </main>
  );
}
