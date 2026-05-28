"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { strings, type Lang, getSavedLang, saveLang, getAvailableLanguages } from "@/lib/i18n";

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

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setLang(getSavedLang());
    const savedTheme = getSavedTheme();
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  function changeLang(l: Lang) { setLang(l); saveLang(l); }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    saveTheme(next);
  }

  const t = strings[lang];

  return (
    <div className="landing-page">
      {/* Top bar */}
      <div className="landing-topbar">
        <div className="landing-topbar-inner">
          <Link href="/" className="navbar-brand">Asibi</Link>
          <div className="landing-topbar-right">
            <div className="landing-lang-select">
              <label htmlFor="lang-select" style={{ margin: 0 }}>{t.language}:</label>
              <select id="lang-select" value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
                {getAvailableLanguages().map(({ code, name }) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            {t.heroBadge}
          </div>

          <h1 className="hero-title">
            {t.heroTitle1}<br /><span>{t.heroTitle2}</span><br />{t.heroTitle3}
          </h1>

          <p className="hero-subtitle">{t.landingDescription}</p>

          <div className="hero-pills">
            <span className="hero-pill">🌍 {t.featureLangTitle}</span>
            <span className="hero-pill">📶 {t.featureOfflineTitle}</span>
            <span className="hero-pill">🌡 {t.featureClimateTitle}</span>
          </div>

          <div className="hero-cta">
            <Link href="/app" className="btn-primary">{t.liveApp}</Link>
            <Link href="/demo" className="btn-outline">{t.demoBtn}</Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-svg-wrap">
            <HeroSVG />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="section-inner">
          <h2 className="section-title">{t.featuresTitle}</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
                </svg>
              </div>
              <h3>{t.featureOfflineTitle}</h3>
              <p>{t.featureOfflineDesc}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                </svg>
              </div>
              <h3>{t.featureClimateTitle}</h3>
              <p>{t.featureClimateDesc}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <h3>{t.featureLangTitle}</h3>
              <p>{t.featureLangDesc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-section">
        <div className="section-inner">
          <h2 className="section-title">{t.howItWorksTitle}</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-num">1</div>
              <div>
                <h3>{t.step1Title}</h3>
                <p>{t.step1Desc}</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div>
                <h3>{t.step2Title}</h3>
                <p>{t.step2Desc}</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div>
                <h3>{t.step3Title}</h3>
                <p>{t.step3Desc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">{t.landingFooter}</footer>
    </div>
  );
}

function HeroSVG() {
  const drSkin = "#8B5A2B";   // doctor — warm medium-dark African brown
  const ptSkin = "#6F3D1A";   // patient — deeper African brown
  const hair   = "#1a0800";   // near-black natural hair

  return (
    <svg viewBox="0 0 320 265" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: "100%", height: "auto", display: "block" }}>

      {/* Background blobs */}
      <ellipse cx="80"  cy="208" rx="62" ry="26" fill="#bae6fd" opacity="0.28"/>
      <ellipse cx="242" cy="215" rx="56" ry="22" fill="#bae6fd" opacity="0.28"/>

      {/* Pulse wave */}
      <polyline points="10,157 44,157 57,127 71,187 87,107 101,157 310,157"
        fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.32"/>

      {/* ═══════════════════════════════════════════
          DOCTOR  (left, standing, teal scrubs)
      ═══════════════════════════════════════════ */}

      {/* Legs — dark navy trousers */}
      <rect x="65"  y="183" width="15" height="52" rx="7" fill="#1e3a5f"/>
      <rect x="84"  y="183" width="15" height="52" rx="7" fill="#1e3a5f"/>
      {/* Shoes */}
      <ellipse cx="72"  cy="236" rx="11" ry="5" fill="#0f172a"/>
      <ellipse cx="91"  cy="236" rx="11" ry="5" fill="#0f172a"/>

      {/* Torso / scrubs */}
      <rect x="56" y="114" width="52" height="74" rx="11" fill="#0ea5e9"/>
      {/* White coat lapels */}
      <path d="M71 114 L82 140 L93 114" fill="white" opacity="0.65"/>

      {/* Left arm — hanging down */}
      <rect x="37" y="118" width="18" height="42" rx="8" fill="#0ea5e9"/>
      {/* Left hand */}
      <ellipse cx="46" cy="163" rx="9" ry="7" fill={drSkin}/>

      {/* Right arm — extended toward patient */}
      <rect x="108" y="117" width="44" height="16" rx="7" fill="#0ea5e9"/>
      {/* Right hand */}
      <ellipse cx="156" cy="125" rx="9" ry="7" fill={drSkin}/>

      {/* Stethoscope tube */}
      <path d="M76 150 Q55 172 62 188" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Chest-piece */}
      <circle cx="62" cy="191" r="6" fill="#475569"/>
      <circle cx="62" cy="191" r="3" fill="#0ea5e9"/>

      {/* Neck */}
      <rect x="74" y="97" width="16" height="19" rx="6" fill={drSkin}/>
      {/* Ears */}
      <ellipse cx="61"  cy="88" rx="4" ry="5.5" fill={drSkin}/>
      <ellipse cx="103" cy="88" rx="4" ry="5.5" fill={drSkin}/>
      {/* Head */}
      <ellipse cx="82" cy="84" rx="22" ry="21" fill={drSkin}/>
      {/* Hair — close-cropped afro cap */}
      <ellipse cx="82" cy="70" rx="22" ry="13" fill={hair}/>
      <path d="M60 82 Q60 66 82 62 Q104 66 104 82 Q104 72 82 68 Q60 72 60 82Z" fill={hair}/>
      {/* Eyebrows */}
      <path d="M72 80 Q75 78 78 80" fill="none" stroke={hair} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M86 80 Q89 78 92 80" fill="none" stroke={hair} strokeWidth="1.4" strokeLinecap="round"/>
      {/* Eyes */}
      <ellipse cx="75" cy="85" rx="3.2" ry="2.8" fill="#1a0800"/>
      <ellipse cx="89" cy="85" rx="3.2" ry="2.8" fill="#1a0800"/>
      <ellipse cx="76" cy="84.5" rx="1.2" ry="1" fill="white"/>
      <ellipse cx="90" cy="84.5" rx="1.2" ry="1" fill="white"/>
      {/* Nose */}
      <path d="M79 90 Q82 94 85 90" fill="none" stroke="#5c2e0e" strokeWidth="1.3" strokeLinecap="round"/>
      {/* Neutral mouth */}
      <line x1="75" y1="97" x2="89" y2="97" stroke="#5c2e0e" strokeWidth="1.6" strokeLinecap="round"/>

      {/* ID badge */}
      <rect x="62" y="127" width="22" height="14" rx="3" fill="white" opacity="0.93"/>
      <rect x="65" y="130" width="16" height="2" rx="1" fill="#0ea5e9"/>
      <rect x="65" y="134" width="11" height="1.5" rx="1" fill="#0ea5e9"/>
      <rect x="65" y="137" width="7"  height="1.5" rx="1" fill="#94a3b8"/>


      {/* ═══════════════════════════════════════════
          PATIENT  (right, seated on chair)
      ═══════════════════════════════════════════ */}

      {/* Chair — back uprights */}
      <rect x="186" y="143" width="8" height="72" rx="4" fill="#94a3b8"/>
      <rect x="256" y="143" width="8" height="72" rx="4" fill="#94a3b8"/>
      {/* Chair — top rail */}
      <rect x="186" y="140" width="78" height="9" rx="4" fill="#94a3b8"/>
      {/* Chair — seat */}
      <rect x="186" y="202" width="78" height="11" rx="5" fill="#94a3b8"/>
      {/* Chair — armrests */}
      <rect x="182" y="170" width="14" height="6" rx="3" fill="#7d8fa3"/>
      <rect x="254" y="170" width="14" height="6" rx="3" fill="#7d8fa3"/>

      {/* Thighs — resting flat on seat */}
      <rect x="195" y="196" width="32" height="14" rx="6" fill="#2c3e50"/>
      <rect x="223" y="196" width="32" height="14" rx="6" fill="#2c3e50"/>
      {/* Lower legs — dangling */}
      <rect x="199" y="208" width="15" height="38" rx="7" fill="#2c3e50"/>
      <rect x="236" y="208" width="15" height="38" rx="7" fill="#2c3e50"/>
      {/* Shoes */}
      <ellipse cx="207" cy="248" rx="11" ry="5" fill="#1a2535"/>
      <ellipse cx="244" cy="248" rx="11" ry="5" fill="#1a2535"/>

      {/* Torso — light shirt */}
      <rect x="194" y="148" width="62" height="54" rx="11" fill="#dde6f0"/>
      {/* Shirt — V-collar */}
      <path d="M213 148 L225 167 L237 148" fill="none" stroke="#b0bfcc" strokeWidth="2" strokeLinejoin="round"/>
      {/* Shirt — buttons */}
      <circle cx="225" cy="172" r="2.2" fill="#b0bfcc"/>
      <circle cx="225" cy="181" r="2.2" fill="#b0bfcc"/>
      <circle cx="225" cy="190" r="2.2" fill="#b0bfcc"/>

      {/* Left arm — resting on armrest */}
      <rect x="182" y="152" width="16" height="26" rx="7" fill="#dde6f0"/>
      {/* Left hand */}
      <ellipse cx="190" cy="180" rx="9" ry="7" fill={ptSkin}/>
      {/* Fingers hint */}
      <path d="M184 177 Q187 174 190 177" fill="none" stroke="#5c2e0e" strokeWidth="1" strokeLinecap="round"/>

      {/* Right arm — resting on armrest */}
      <rect x="252" y="152" width="16" height="26" rx="7" fill="#dde6f0"/>
      {/* Right hand */}
      <ellipse cx="260" cy="180" rx="9" ry="7" fill={ptSkin}/>
      <path d="M254 177 Q257 174 260 177" fill="none" stroke="#5c2e0e" strokeWidth="1" strokeLinecap="round"/>

      {/* Neck */}
      <rect x="218" y="127" width="14" height="23" rx="6" fill={ptSkin}/>
      {/* Ears */}
      <ellipse cx="203" cy="116" rx="4.5" ry="6" fill={ptSkin}/>
      <ellipse cx="247" cy="116" rx="4.5" ry="6" fill={ptSkin}/>
      {/* Head */}
      <ellipse cx="225" cy="110" rx="24" ry="23" fill={ptSkin}/>
      {/* Hair — natural afro, fuller */}
      <ellipse cx="225" cy="93"  rx="24" ry="15" fill={hair}/>
      <path d="M201 108 Q201 90 225 85 Q249 90 249 108 Q249 96 225 92 Q201 96 201 108Z" fill={hair}/>
      {/* Slight sideburns */}
      <ellipse cx="202" cy="112" rx="3" ry="6" fill={hair}/>
      <ellipse cx="248" cy="112" rx="3" ry="6" fill={hair}/>

      {/* Eyebrows — slightly furrowed (unwell) */}
      <path d="M213 104 Q216.5 101.5 220 103.5" fill="none" stroke={hair} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M230 103.5 Q233.5 101.5 237 104"   fill="none" stroke={hair} strokeWidth="1.6" strokeLinecap="round"/>
      {/* Eyes — half-lidded / tired */}
      <ellipse cx="217" cy="110" rx="3.5" ry="3" fill="#1a0800"/>
      <ellipse cx="233" cy="110" rx="3.5" ry="3" fill="#1a0800"/>
      <ellipse cx="218" cy="109.5" rx="1.3" ry="1.1" fill="white"/>
      <ellipse cx="234" cy="109.5" rx="1.3" ry="1.1" fill="white"/>
      {/* Drooping upper eyelids */}
      <path d="M213.5 107.5 Q217 105.5 220.5 107.5" fill="#6F3D1A" opacity="0.6"/>
      <path d="M229.5 107.5 Q233 105.5 236.5 107.5" fill="#6F3D1A" opacity="0.6"/>
      {/* Nose */}
      <path d="M222 116 Q225 120 228 116" fill="none" stroke="#4a2510" strokeWidth="1.4" strokeLinecap="round"/>
      {/* Downturned mouth — feeling unwell */}
      <path d="M218 124 Q225 121 232 124" fill="none" stroke="#4a2510" strokeWidth="1.6" strokeLinecap="round"/>

      {/* ── Medical clipboard (top-left) ── */}
      <rect x="14" y="28" width="36" height="46" rx="5" fill="white" stroke="#cbd5e1" strokeWidth="1.5"/>
      <rect x="26" y="23" width="12" height="10" rx="3" fill="#0ea5e9"/>
      <line x1="20" y1="45" x2="44" y2="45" stroke="#e2e8f0" strokeWidth="2"/>
      <line x1="20" y1="52" x2="44" y2="52" stroke="#e2e8f0" strokeWidth="2"/>
      <line x1="20" y1="59" x2="36" y2="59" stroke="#e2e8f0" strokeWidth="2"/>
      <path d="M21 45 l3 3 l6-6" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>

      {/* ── Medical cross (top-right) ── */}
      <rect x="272" y="22" width="36" height="36" rx="10" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1.5"/>
      <rect x="286" y="28" width="8" height="24" rx="3" fill="#0ea5e9"/>
      <rect x="279" y="35" width="22" height="8" rx="3" fill="#0ea5e9"/>

      {/* ── Heart rate indicator ── */}
      <rect x="120" y="22" width="80" height="28" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
      <polyline points="126,36 134,36 139,28 144,44 150,24 155,36 194,36"
        fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
