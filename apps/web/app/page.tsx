"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { strings, type Lang, getSavedLang, saveLang, getAvailableLanguages } from "@/lib/i18n";

function getSavedTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (window.localStorage.getItem("daghe_theme") as "light" | "dark") ?? "light";
}

function saveTheme(theme: "light" | "dark") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("daghe_theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new CustomEvent("daghe:themechange", { detail: theme }));
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
          <Link href="/" className="navbar-brand">Daghe</Link>
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
            <span className="hero-pill">🔬 {t.featureClimateTitle}</span>
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
                {/* Medical imaging / multi-modal icon: eye with scan lines */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="12" y1="5" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="19" y2="12"/>
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

      <footer className="landing-footer">
        {t.landingFooter}
        {" · "}
        <Link href="/about" style={{ color: "inherit", textDecoration: "underline" }}>About</Link>
        {" · "}
        <Link href="/help" style={{ color: "inherit", textDecoration: "underline" }}>Help</Link>
      </footer>
    </div>
  );
}

function HeroSVG() {
  // Skin tones — warm African brown palette
  const chwSkin  = "#7B3F10";   // CHW — deep warm brown
  const ptSkin   = "#B5713A";   // patient — medium-warm brown
  const hair     = "#1C0A00";   // near-black natural hair
  const chwSkinDark = "#5C2E08"; // shadows on CHW skin

  return (
    <svg viewBox="0 0 360 290" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        {/* Warm ambient light gradient */}
        <radialGradient id="bgGlow" cx="70%" cy="20%" r="65%">
          <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#f0f9ff" stopOpacity="0"/>
        </radialGradient>
        {/* Green glow behind phone result */}
        <radialGradient id="greenGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0"/>
        </radialGradient>
        {/* Screen gradient */}
        <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc"/>
          <stop offset="100%" stopColor="#f1f5f9"/>
        </linearGradient>
      </defs>

      {/* ── BACKGROUND ── */}
      <rect width="360" height="290" fill="#faf8f4"/>
      <rect width="360" height="290" fill="url(#bgGlow)"/>
      {/* Floor */}
      <rect x="0" y="260" width="360" height="30" fill="#e8dcc8" opacity="0.45"/>
      <line x1="0" y1="260" x2="360" y2="260" stroke="#c8b49a" strokeWidth="1"/>
      {/* Subtle wall panel line */}
      <line x1="0" y1="20" x2="360" y2="20" stroke="#e8e0d4" strokeWidth="0.8"/>

      {/* ── AI NEURAL NETWORK (floating top, behind everything) ── */}
      {/* Connection lines first, then nodes on top */}
      <line x1="52" y1="38" x2="96" y2="22" stroke="#0ea5e9" strokeWidth="0.7" opacity="0.3"/>
      <line x1="96" y1="22" x2="148" y2="14" stroke="#0ea5e9" strokeWidth="0.7" opacity="0.3"/>
      <line x1="148" y1="14" x2="192" y2="24" stroke="#0ea5e9" strokeWidth="0.9" opacity="0.35"/>
      <line x1="192" y1="24" x2="232" y2="12" stroke="#7c3aed" strokeWidth="0.7" opacity="0.28"/>
      <line x1="232" y1="12" x2="278" y2="28" stroke="#7c3aed" strokeWidth="0.7" opacity="0.28"/>
      <line x1="278" y1="28" x2="316" y2="18" stroke="#0ea5e9" strokeWidth="0.7" opacity="0.28"/>
      <line x1="52" y1="38" x2="34" y2="58" stroke="#0ea5e9" strokeWidth="0.7" opacity="0.25"/>
      <line x1="148" y1="14" x2="162" y2="44" stroke="#16A34A" strokeWidth="1" opacity="0.4"/>
      <line x1="192" y1="24" x2="162" y2="44" stroke="#16A34A" strokeWidth="1" opacity="0.4"/>
      <line x1="232" y1="12" x2="162" y2="44" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.3"/>
      <line x1="162" y1="44" x2="174" y2="108" stroke="#16A34A" strokeWidth="1" strokeDasharray="3,3" opacity="0.35"/>
      {/* Outer pulse rings on green hub */}
      <circle cx="162" cy="44" r="13" fill="none" stroke="#16A34A" strokeWidth="0.8" opacity="0.22"/>
      <circle cx="162" cy="44" r="19" fill="none" stroke="#16A34A" strokeWidth="0.5" opacity="0.14"/>
      {/* Network nodes */}
      <circle cx="52"  cy="38"  r="4.5" fill="#0ea5e9" opacity="0.65"/>
      <circle cx="96"  cy="22"  r="3.5" fill="#0ea5e9" opacity="0.55"/>
      <circle cx="148" cy="14"  r="5.5" fill="#0ea5e9" opacity="0.75"/>
      <circle cx="192" cy="24"  r="4"   fill="#0ea5e9" opacity="0.6"/>
      <circle cx="232" cy="12"  r="3.5" fill="#7c3aed" opacity="0.5"/>
      <circle cx="278" cy="28"  r="4"   fill="#7c3aed" opacity="0.5"/>
      <circle cx="316" cy="18"  r="3"   fill="#0ea5e9" opacity="0.45"/>
      <circle cx="34"  cy="58"  r="3"   fill="#0ea5e9" opacity="0.4"/>
      {/* Central green hub (result node) */}
      <circle cx="162" cy="44"  r="6.5" fill="#16A34A" opacity="0.8"/>
      <circle cx="162" cy="44"  r="3.5" fill="white"   opacity="0.9"/>

      {/* ── BENCH ── */}
      {/* Back rail */}
      <rect x="18" y="182" width="128" height="9" rx="4.5" fill="#8B6340"/>
      <rect x="26" y="190" width="9" height="38" rx="4" fill="#6B4A2E"/>
      <rect x="128" y="190" width="9" height="38" rx="4" fill="#6B4A2E"/>
      {/* Seat */}
      <rect x="18" y="215" width="128" height="11" rx="5" fill="#A0784A"/>
      {/* Seat shadow underside */}
      <rect x="18" y="222" width="128" height="4" rx="2" fill="#6B4A2E" opacity="0.35"/>
      {/* Front legs */}
      <rect x="26" y="225" width="9" height="35" rx="4" fill="#6B4A2E"/>
      <rect x="128" y="225" width="9" height="35" rx="4" fill="#6B4A2E"/>

      {/* ══════════════════════════════════════════
          PATIENT  (female, seated left on bench)
          skin: #B5713A medium warm brown
      ══════════════════════════════════════════ */}

      {/* Thighs on bench */}
      <rect x="44"  y="210" width="32" height="13" rx="6" fill="#2C3340"/>
      <rect x="76"  y="210" width="32" height="13" rx="6" fill="#2C3340"/>
      {/* Lower legs */}
      <rect x="48"  y="221" width="16" height="39" rx="7" fill="#2C3340"/>
      <rect x="82"  y="221" width="16" height="39" rx="7" fill="#2C3340"/>
      {/* Sandals */}
      <ellipse cx="56"  cy="261" rx="13" ry="5.5" fill="#5D3A22"/>
      <ellipse cx="90"  cy="261" rx="13" ry="5.5" fill="#5D3A22"/>
      {/* Sandal strap */}
      <rect x="44" y="256" width="24" height="3" rx="1.5" fill="#7A4E2E"/>
      <rect x="78" y="256" width="24" height="3" rx="1.5" fill="#7A4E2E"/>

      {/* Ankara-print top — deep blue base */}
      <rect x="36" y="144" width="72" height="72" rx="13" fill="#1A4A8F"/>
      {/* Ankara geometric prints — orange diamond shapes */}
      <polygon points="55,144 72,144 63,158" fill="#F97316" opacity="0.85"/>
      <polygon points="91,144 108,144 99,158" fill="#F97316" opacity="0.85"/>
      <polygon points="55,185 72,185 63,199" fill="#F97316" opacity="0.7"/>
      <polygon points="91,185 108,185 99,199" fill="#F97316" opacity="0.7"/>
      {/* Gold circle motif center */}
      <circle cx="72" cy="174" r="10" fill="none" stroke="#FBBF24" strokeWidth="1.8" opacity="0.7"/>
      <circle cx="72" cy="174" r="5"  fill="#FBBF24" opacity="0.3"/>
      {/* V-neckline */}
      <path d="M63 144 L72 162 L81 144" fill="none" stroke="#132C5C" strokeWidth="1.8" strokeLinejoin="round"/>

      {/* Left arm (patient's right — resting on lap) */}
      <rect x="22" y="150" width="17" height="36" rx="7.5" fill="#1A4A8F"/>
      <ellipse cx="30" cy="190" rx="11" ry="8"  fill={ptSkin}/>

      {/* Right arm (patient's left — extended slightly toward phone, hopeful gesture) */}
      <rect x="107" y="148" width="17" height="44" rx="7.5" fill="#1A4A8F"/>
      <ellipse cx="128" cy="196" rx="10" ry="8" fill={ptSkin}/>
      {/* Fingers — slight reach */}
      <path d="M121 192 Q128 188 135 192" fill="none" stroke="#8B4A1A" strokeWidth="1.1" strokeLinecap="round"/>

      {/* Neck */}
      <rect x="64" y="123" width="16" height="23" rx="7" fill={ptSkin}/>

      {/* Ears — with gold drop earrings */}
      <ellipse cx="50"  cy="117" rx="4.5" ry="6" fill={ptSkin}/>
      <ellipse cx="94"  cy="117" rx="4.5" ry="6" fill={ptSkin}/>
      <circle  cx="50"  cy="124" r="3.5" fill="#FFD700"/>
      <circle  cx="50"  cy="129" r="2"   fill="#FFD700"/>
      <circle  cx="94"  cy="124" r="3.5" fill="#FFD700"/>
      <circle  cx="94"  cy="129" r="2"   fill="#FFD700"/>

      {/* Head */}
      <ellipse cx="72" cy="107" rx="26" ry="25" fill={ptSkin}/>

      {/* GELE / HEAD WRAP — layered kente-inspired orange and gold */}
      {/* Base layer — burnt orange, covers all hair */}
      <ellipse cx="72" cy="91"  rx="28" ry="18" fill="#C2410C"/>
      <path d="M44 100 Q44 80 72 74 Q100 80 100 100 Q100 88 72 84 Q44 88 44 100Z" fill="#C2410C"/>
      {/* Second layer — gold-amber, overlapping */}
      <path d="M47 95 Q47 78 72 73 Q97 78 97 95 Q97 84 72 80 Q47 84 47 95Z" fill="#F59E0B"/>
      {/* Top fold — cream/tan accent stripe */}
      <path d="M51 88 Q72 80 93 88" fill="none" stroke="#FEF3C7" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Wrap folds / ridges */}
      <path d="M49 94 Q72 84 95 94" fill="none" stroke="#EA580C" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M46 101 Q72 90 98 101" fill="none" stroke="#C2410C" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Gele knot — right side twist, traditional style */}
      <ellipse cx="96" cy="84" rx="11" ry="8" fill="#C2410C"/>
      <ellipse cx="98" cy="80" rx="8"  ry="6" fill="#F59E0B"/>
      <ellipse cx="96" cy="87" rx="7"  ry="4" fill="#EA580C"/>
      {/* Knot ridges */}
      <path d="M89 83 Q96 79 103 83" fill="none" stroke="#FEF3C7" strokeWidth="1.2" strokeLinecap="round"/>

      {/* Patient face features */}
      {/* Eyebrows — relaxed, slightly raised (hopeful) */}
      <path d="M61 103 Q65 100 69 102"   fill="none" stroke={hair} strokeWidth="1.9" strokeLinecap="round"/>
      <path d="M75 102 Q79 100 83 103"   fill="none" stroke={hair} strokeWidth="1.9" strokeLinecap="round"/>
      {/* Eyes — open, warm, looking toward phone */}
      <ellipse cx="65" cy="108" rx="4"   ry="3.5" fill="#1A0800"/>
      <ellipse cx="79" cy="108" rx="4"   ry="3.5" fill="#1A0800"/>
      <ellipse cx="66" cy="107" rx="1.5" ry="1.2" fill="white"/>
      <ellipse cx="80" cy="107" rx="1.5" ry="1.2" fill="white"/>
      {/* Nose — full, rounded */}
      <path d="M69 115 Q72 119 75 115" fill="none" stroke="#8B4A1A" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="68.5" cy="117" r="1.4" fill="#8B4A1A" opacity="0.45"/>
      <circle cx="75.5" cy="117" r="1.4" fill="#8B4A1A" opacity="0.45"/>
      {/* Warm relieved smile */}
      <path d="M63 124 Q72 129 81 124"   fill="none" stroke="#7A3B12" strokeWidth="2" strokeLinecap="round"/>
      {/* Smile cheek blush */}
      <ellipse cx="60" cy="120" rx="5"   ry="3"   fill="#C07048" opacity="0.22"/>
      <ellipse cx="84" cy="120" rx="5"   ry="3"   fill="#C07048" opacity="0.22"/>

      {/* ══════════════════════════════════════════
          SMARTPHONE (center — the hero element)
          Showing Daghe NEGATIVE result screen
      ══════════════════════════════════════════ */}

      {/* Green glow behind phone */}
      <ellipse cx="192" cy="168" rx="52" ry="60" fill="url(#greenGlow)"/>

      {/* Phone shadow */}
      <rect x="163" y="104" width="60" height="107" rx="11" fill="#0f172a" opacity="0.14"/>
      {/* Phone body — dark slate */}
      <rect x="160" y="100" width="60" height="108" rx="11" fill="#1e293b"/>
      {/* Phone side buttons */}
      <rect x="156" y="122" width="4" height="12" rx="2" fill="#334155"/>
      <rect x="156" y="138" width="4" height="12" rx="2" fill="#334155"/>
      <rect x="220" y="126" width="4" height="16" rx="2" fill="#334155"/>
      {/* Phone screen bezel */}
      <rect x="163" y="104" width="54" height="100" rx="8" fill="url(#screenGrad)"/>
      {/* Dynamic Island / front camera */}
      <rect x="181" y="106" width="18" height="5" rx="2.5" fill="#1e293b"/>

      {/* ── DAGHE APP UI ── */}
      {/* Status bar */}
      <rect x="163" y="112" width="54" height="9" fill="#0ea5e9"/>
      <text x="190" y="118.5" textAnchor="middle" fontSize="5.5" fill="white" fontFamily="system-ui,sans-serif" fontWeight="700">Daghe</text>
      {/* Signal dot */}
      <circle cx="173" cy="117" r="1.8" fill="white" opacity="0.8"/>

      {/* BIG GREEN NEGATIVE RESULT */}
      <rect x="163" y="121" width="54" height="44" fill="#16A34A"/>
      {/* Inner result card glow */}
      <rect x="165" y="123" width="50" height="40" rx="4" fill="#15803D"/>
      {/* Large checkmark circle */}
      <circle cx="190" cy="135" r="12" fill="white" opacity="0.15"/>
      <circle cx="190" cy="135" r="9"  fill="white" opacity="0.12"/>
      {/* Checkmark */}
      <path d="M183 135 L188 140 L198 128" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
      {/* NEGATIVE text */}
      <text x="190" y="150" textAnchor="middle" fontSize="6" fill="white" fontFamily="system-ui,sans-serif" fontWeight="900" letterSpacing="0.4">NEGATIVE</text>
      <text x="190" y="157" textAnchor="middle" fontSize="3.5" fill="white" fontFamily="system-ui,sans-serif" opacity="0.88">No finding detected</text>
      <text x="190" y="162" textAnchor="middle" fontSize="3" fill="white" fontFamily="system-ui,sans-serif" opacity="0.7">Cervical VIA screening</text>

      {/* Confidence band row */}
      <rect x="166" y="166" width="51" height="10" rx="5" fill="#dcfce7"/>
      <rect x="166" y="166" width="19" height="10" rx="5" fill="#16A34A"/>
      <text x="175.5" y="172.5" textAnchor="middle" fontSize="4" fill="white" fontFamily="system-ui,sans-serif" fontWeight="800">HIGH</text>
      <text x="198"   y="172.5" textAnchor="middle" fontSize="3.3" fill="#166534" fontFamily="system-ui,sans-serif">Confidence</text>

      {/* Inference chip */}
      <rect x="166" y="178" width="51" height="9" rx="4" fill="#f1f5f9"/>
      <circle cx="172" cy="182.5" r="2.5" fill="#0ea5e9"/>
      {/* On-device AI icon: tiny chip outline */}
      <rect x="169.5" y="180" width="5" height="5" rx="1" fill="none" stroke="#0ea5e9" strokeWidth="0.8"/>
      <text x="196"   y="184.5" textAnchor="middle" fontSize="3.2" fill="#475569" fontFamily="system-ui,sans-serif">On-device AI · No cost</text>

      {/* Save encounter button */}
      <rect x="166" y="189" width="51" height="10" rx="5" fill="#0ea5e9"/>
      <text x="191.5" y="195.5" textAnchor="middle" fontSize="4" fill="white" fontFamily="system-ui,sans-serif" fontWeight="700">Save Encounter</text>

      {/* Home indicator bar */}
      <rect x="178" y="201" width="24" height="2.5" rx="1.25" fill="#475569" opacity="0.4"/>

      {/* ══════════════════════════════════════════
          CHW  (female, standing right, holding phone)
          skin: #7B3F10 deep warm brown
      ══════════════════════════════════════════ */}

      {/* Legs — dark trousers */}
      <rect x="253" y="196" width="17" height="64" rx="7.5" fill="#1e3a5f"/>
      <rect x="275" y="196" width="17" height="64" rx="7.5" fill="#1e3a5f"/>
      {/* Shoes — low-heeled professional */}
      <ellipse cx="261" cy="262" rx="15" ry="6"   fill="#0f172a"/>
      <ellipse cx="283" cy="262" rx="15" ry="6"   fill="#0f172a"/>
      {/* Trouser crease */}
      <line x1="261" y1="200" x2="261" y2="258" stroke="#1a3254" strokeWidth="0.8" opacity="0.5"/>
      <line x1="283" y1="200" x2="283" y2="258" stroke="#1a3254" strokeWidth="0.8" opacity="0.5"/>

      {/* Clinic vest (white) — with kente-stripe collar and cuff trim */}
      {/* Vest back/body base */}
      <rect x="236" y="115" width="74" height="86" rx="12" fill="#f0f9ff"/>
      {/* Blue undershirt at neckline and sides */}
      <rect x="250" y="114" width="46" height="18" rx="8" fill="#bfdbfe"/>
      {/* Vest left panel */}
      <rect x="238" y="122" width="31" height="79" rx="6" fill="white" stroke="#cbd5e1" strokeWidth="0.8"/>
      {/* Vest right panel */}
      <rect x="277" y="122" width="31" height="79" rx="6" fill="white" stroke="#cbd5e1" strokeWidth="0.8"/>
      {/* Center opening strip */}
      <rect x="269" y="122" width="8"  height="79" fill="#dbeafe"/>
      {/* KENTE trim collar — 4-stripe geometric band */}
      <rect x="236" y="114" width="74" height="9" rx="4" fill="#D97706"/>
      <rect x="236" y="114" width="74" height="3" rx="1.5" fill="#EF4444" opacity="0.7"/>
      <rect x="236" y="119" width="74" height="2" rx="1" fill="#1a3a5f" opacity="0.5"/>
      {/* Kente trim dots on collar */}
      <circle cx="245" cy="117" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="258" cy="117" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="271" cy="117" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="284" cy="117" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="297" cy="117" r="1.8" fill="white" opacity="0.9"/>
      {/* Pocket on left vest panel */}
      <rect x="242" y="155" width="24" height="18" rx="3" fill="#e0f2fe" stroke="#bae6fd" strokeWidth="0.8"/>
      {/* Pen in pocket */}
      <rect x="254" y="151" width="3" height="12" rx="1.5" fill="#0ea5e9"/>
      <polygon points="254,163 256,163 255,167" fill="#1e3a5f"/>

      {/* CHW left arm — extended forward to hold the phone */}
      {/* Upper arm */}
      <rect x="210" y="118" width="27" height="18" rx="8" fill="#bfdbfe"/>
      {/* Forearm angled toward phone level */}
      <rect x="200" y="134" width="26" height="16" rx="7" fill="#bfdbfe"/>
      {/* Left hand gripping phone bottom */}
      <ellipse cx="197" cy="148" rx="12" ry="9" fill={chwSkin}/>
      {/* Thumb detail */}
      <ellipse cx="189" cy="145" rx="5"  ry="4"  fill={chwSkin}/>
      {/* Finger curl hint */}
      <path d="M192 140 Q197 136 202 140" fill="none" stroke={chwSkinDark} strokeWidth="1.1" strokeLinecap="round"/>

      {/* CHW right arm — hanging, slight bend, relaxed */}
      <rect x="308" y="120" width="20" height="52" rx="9" fill="#bfdbfe"/>
      <ellipse cx="318" cy="176" rx="12" ry="9"  fill={chwSkin}/>
      <path d="M311 172 Q318 168 325 172" fill="none" stroke={chwSkinDark} strokeWidth="1.1" strokeLinecap="round"/>

      {/* Neck */}
      <rect x="261" y="92" width="16" height="24" rx="7" fill={chwSkin}/>

      {/* Ears */}
      <ellipse cx="248" cy="83" rx="4.5" ry="6" fill={chwSkin}/>
      <ellipse cx="290" cy="83" rx="4.5" ry="6" fill={chwSkin}/>
      {/* Gold stud earrings */}
      <circle  cx="248" cy="85" r="3"   fill="#FFD700"/>
      <circle  cx="290" cy="85" r="3"   fill="#FFD700"/>

      {/* Head */}
      <ellipse cx="269" cy="74" rx="25" ry="24" fill={chwSkin}/>

      {/* Natural hair — neat twist-out / updo crown */}
      {/* Base hair mass */}
      <ellipse cx="269" cy="57" rx="26" ry="15" fill={hair}/>
      <path d="M244 68 Q244 50 269 45 Q294 50 294 68 Q294 57 269 53 Q244 57 244 68Z" fill={hair}/>
      {/* Crown twist rolls — 5 defined coils forming the updo */}
      <ellipse cx="258" cy="49" rx="8"  ry="6"  fill="#2D1200"/>
      <ellipse cx="272" cy="45" rx="9"  ry="6.5" fill="#2D1200"/>
      <ellipse cx="286" cy="50" rx="7"  ry="5.5" fill="#2D1200"/>
      <ellipse cx="262" cy="43" rx="6"  ry="4.5" fill="#3D1A00"/>
      <ellipse cx="278" cy="42" rx="7"  ry="5"   fill="#3D1A00"/>
      {/* Hair edge — defined hairline */}
      <path d="M244 72 Q256 62 269 60 Q282 62 294 72" fill="none" stroke={hair} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Crown band / accessory — gold headband accent */}
      <path d="M247 65 Q269 56 291 65" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="269" cy="57" r="3"   fill="#FBBF24"/>
      <circle cx="255" cy="61" r="2"   fill="#FBBF24" opacity="0.7"/>
      <circle cx="283" cy="61" r="2"   fill="#FBBF24" opacity="0.7"/>

      {/* CHW face features */}
      {/* Eyebrows — confident, professional arch */}
      <path d="M258 70 Q262 67 266 69"   fill="none" stroke={hair} strokeWidth="2" strokeLinecap="round"/>
      <path d="M272 69 Q276 67 280 70"   fill="none" stroke={hair} strokeWidth="2" strokeLinecap="round"/>
      {/* Eyes — focused gaze at phone screen, confident */}
      <ellipse cx="262" cy="75" rx="4"   ry="3.5" fill="#1A0800"/>
      <ellipse cx="276" cy="75" rx="4"   ry="3.5" fill="#1A0800"/>
      <ellipse cx="263" cy="74" rx="1.5" ry="1.2" fill="white"/>
      <ellipse cx="277" cy="74" rx="1.5" ry="1.2" fill="white"/>
      {/* Lower lid definition */}
      <path d="M258.5 78 Q262 76.5 265.5 78" fill="none" stroke={chwSkinDark} strokeWidth="0.8" strokeLinecap="round" opacity="0.5"/>
      <path d="M272.5 78 Q276 76.5 279.5 78" fill="none" stroke={chwSkinDark} strokeWidth="0.8" strokeLinecap="round" opacity="0.5"/>
      {/* Nose — strong, full */}
      <path d="M266 82 Q269 86 272 82"   fill="none" stroke={chwSkinDark} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="265.5" cy="84" r="1.5" fill={chwSkinDark} opacity="0.4"/>
      <circle cx="272.5" cy="84" r="1.5" fill={chwSkinDark} opacity="0.4"/>
      {/* Warm confident smile */}
      <path d="M260 90 Q269 95 278 90"   fill="none" stroke={chwSkinDark} strokeWidth="2" strokeLinecap="round"/>
      {/* Smile cheek definition */}
      <ellipse cx="257" cy="88" rx="4.5" ry="2.5" fill="#9A5522" opacity="0.2"/>
      <ellipse cx="281" cy="88" rx="4.5" ry="2.5" fill="#9A5522" opacity="0.2"/>

      {/* CHW ID badge + lanyard */}
      <line x1="269" y1="113" x2="264" y2="142" stroke="#94a3b8" strokeWidth="1.6"/>
      <rect x="254" y="141" width="21" height="15" rx="3.5" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <rect x="257" y="145" width="15" height="2.5" rx="1" fill="#0ea5e9"/>
      <rect x="257" y="149" width="10" height="1.8" rx="0.9" fill="#94a3b8"/>
      <rect x="257" y="152" width="6"  height="1.8" rx="0.9" fill="#94a3b8"/>

      {/* ── CORNER DECORATIONS ── */}
      {/* Top-left: AI chip widget */}
      <rect x="8" y="26" width="46" height="26" rx="7" fill="white" stroke="#e2e8f0" strokeWidth="1.2" opacity="0.95"/>
      {/* Chip body */}
      <rect x="16" y="31" width="18" height="16" rx="3.5" fill="#0ea5e9"/>
      {/* Chip pins */}
      <line x1="16" y1="35" x2="12" y2="35" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="16" y1="39" x2="12" y2="39" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="16" y1="43" x2="12" y2="43" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="34" y1="35" x2="38" y2="35" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="34" y1="39" x2="38" y2="39" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="34" y1="43" x2="38" y2="43" stroke="#94a3b8" strokeWidth="1.2"/>
      <text x="25" y="41.5" textAnchor="middle" fontSize="7" fill="white" fontFamily="system-ui,sans-serif" fontWeight="900">AI</text>
      <text x="42" y="36" fontSize="3.8" fill="#64748b" fontFamily="system-ui,sans-serif">on</text>
      <text x="42" y="41" fontSize="3.8" fill="#64748b" fontFamily="system-ui,sans-serif">device</text>
      <text x="42" y="46" fontSize="3.8" fill="#16A34A" fontFamily="system-ui,sans-serif" fontWeight="700">active</text>

      {/* Top-right: connectivity / sync indicator */}
      <rect x="306" y="26" width="46" height="26" rx="7" fill="white" stroke="#e2e8f0" strokeWidth="1.2" opacity="0.95"/>
      {/* WiFi arcs */}
      <circle cx="329" cy="46" r="2.5" fill="#0ea5e9"/>
      <path d="M323 42 Q329 36 335 42" fill="none" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M318 37 Q329 28 340 37" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <path d="M314 33 Q329 21 344 33" fill="none" stroke="#0ea5e9" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
      <text x="329" y="33" textAnchor="middle" fontSize="3.5" fill="#16A34A" fontFamily="system-ui,sans-serif" fontWeight="700">ONLINE</text>

      {/* Bottom: scan data wave strip (not the full ECG, a subtle AI scan line) */}
      <rect x="0" y="270" width="360" height="20" fill="#f0f9ff" opacity="0.5"/>
      <polyline
        points="0,280 22,280 30,274 38,286 46,270 54,280 80,280 88,275 96,285 104,272 112,280 145,280 150,276 155,284 160,280 360,280"
        fill="none" stroke="#0ea5e9" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"
      />
      {/* Result dot on scan line */}
      <circle cx="160" cy="280" r="3.5" fill="#16A34A" opacity="0.7"/>
      <circle cx="160" cy="280" r="6"   fill="#16A34A" opacity="0.2"/>

    </svg>
  );
}
