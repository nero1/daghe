"use client";

import { useEffect, useState } from "react";
import { strings, type Lang, getSavedLang, saveLang, getAvailableLanguages } from "@/lib/i18n";

export default function HelpPage() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => { setLang(getSavedLang()); }, []);

  function changeLang(l: Lang) { setLang(l); saveLang(l); }

  const t = strings[lang];

  return (
    <main className="help-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".75rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-.03em" }}>
          {t.helpPageTitle}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".85rem", color: "#64748b" }}>
          <label htmlFor="help-lang" style={{ margin: 0, fontWeight: 500 }}>{t.language}</label>
          <select
            id="help-lang"
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

      <p className="help-intro">{t.helpIntro}</p>

      {/* How It Works */}
      <div>
        <h2 className="help-section-title">{t.howItWorksTitle}</h2>
        <div className="help-steps">
          <div className="help-step">
            <div className="help-step-num">1</div>
            <div className="help-step-content">
              <h3>{t.step1Title}</h3>
              <p>{t.step1Desc}</p>
            </div>
          </div>
          <div className="help-step">
            <div className="help-step-num">2</div>
            <div className="help-step-content">
              <h3>{t.step2Title}</h3>
              <p>{t.step2Desc}</p>
            </div>
          </div>
          <div className="help-step">
            <div className="help-step-num">3</div>
            <div className="help-step-content">
              <h3>{t.step3Title}</h3>
              <p>{t.step3Desc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed User Guides */}
      <div>
        <h2 className="help-section-title">{t.helpGuidesTitle}</h2>
        <div className="help-guides">
          <div className="help-guide">
            <h3>{t.helpGuide1Title}</h3>
            <p>{t.helpGuide1Desc}</p>
          </div>
          <div className="help-guide">
            <h3>{t.helpGuide2Title}</h3>
            <p>{t.helpGuide2Desc}</p>
          </div>
          <div className="help-guide">
            <h3>{t.helpGuide3Title}</h3>
            <p>{t.helpGuide3Desc}</p>
          </div>
          <div className="help-guide">
            <h3>{t.helpGuide4Title}</h3>
            <p>{t.helpGuide4Desc}</p>
          </div>
          <div className="help-guide">
            <h3>{t.helpGuide5Title}</h3>
            <p>{t.helpGuide5Desc}</p>
          </div>
        </div>
      </div>

      {/* Classification legend — replaces Asibi risk level legend */}
      <div>
        <h2 className="help-section-title">{t.classificationLegendTitle}</h2>
        <p style={{ marginBottom: "1rem", color: "#374151", fontSize: ".9rem" }}>{t.classificationLegendIntro}</p>
        <div style={{ display: "grid", gap: ".75rem", marginBottom: "1.5rem" }}>
          {(
            [
              { label: t.classificationNegativeLabel, desc: t.classificationNegativeDesc, bg: "#16A34A", fg: "#fff" },
              { label: t.classificationPositiveLabel, desc: t.classificationPositiveDesc, bg: "#DC2626", fg: "#fff" },
              { label: t.classificationReferLabel, desc: t.classificationReferDesc, bg: "#D97706", fg: "#1C1917" },
            ] as const
          ).map(({ label, desc, bg, fg }) => (
            <div key={label} style={{ background: bg, color: fg, borderRadius: 10, padding: "12px 16px" }}>
              <strong style={{ fontSize: "1rem", display: "block", marginBottom: 4 }}>{label}</strong>
              <span style={{ fontSize: ".875rem", opacity: 0.92 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence bands */}
      <div>
        <h2 className="help-section-title">{t.confidenceBandTitle}</h2>
        <div className="help-risk-legend" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {(
            [
              { band: "HIGH", color: "#16A34A", fg: "#fff", desc: t.confidenceBandHigh },
              { band: "MODERATE", color: "#D97706", fg: "#1C1917", desc: t.confidenceBandModerate },
              { band: "LOW", color: "#DC2626", fg: "#fff", desc: t.confidenceBandLow },
              { band: "REFERENCE ONLY", color: "#6B7280", fg: "#fff", desc: t.confidenceBandReference },
            ] as const
          ).map(({ band, color, fg, desc }) => (
            <div key={band} style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", marginBottom: ".5rem" }}>
              <span style={{ background: color, color: fg, fontWeight: 700, fontSize: ".75rem", padding: ".3rem .75rem", borderRadius: "2rem", whiteSpace: "nowrap", minWidth: 110, textAlign: "center", flexShrink: 0 }}>
                {band}
              </span>
              <span style={{ fontSize: ".85rem", color: "#374151", paddingTop: ".2rem" }}>{desc}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: ".75rem", fontSize: ".85rem", color: "#1e3a5f", fontWeight: 600, background: "#eff6ff", padding: ".6rem .9rem", borderRadius: 8 }}>
          {t.helpSafetyNote}
        </p>
      </div>
    </main>
  );
}
