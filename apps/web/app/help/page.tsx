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

      {/* Risk level legend */}
      <div>
        <h2 className="help-section-title">{t.riskLevel}</h2>
        <div className="help-risk-legend">
          {(
            [
              { key: "risk_monitor" as const, color: "#2e7d32" },
              { key: "risk_treat_local" as const, color: "#1565c0" },
              { key: "risk_refer" as const, color: "#7b1fa2" },
              { key: "risk_urgent" as const, color: "#e65100" },
              { key: "risk_emergency" as const, color: "#b71c1c" },
            ] as const
          ).map(({ key, color }) => (
            <span
              key={key}
              style={{
                background: color, color: "white", fontWeight: 700,
                fontSize: ".85rem", padding: ".35rem .9rem", borderRadius: "2rem",
                display: "inline-block",
              }}
            >
              {t[key]}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
