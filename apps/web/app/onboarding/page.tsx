"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/lib/onboarding";
import { strings, type Lang, getSavedLang } from "@/lib/i18n";

export default function OnboardingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");

  const [step, setStep] = useState<"consent" | "profile">("consent");
  const [clinicCode, setClinicCode] = useState("");
  const [chwId, setChwId] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    setLang(getSavedLang());
  }, []);

  const t = strings[lang];

  function acceptConsent() {
    if (!agreed) return;
    setStep("profile");
  }

  function completeOnboarding() {
    saveProfile({ clinicCode: clinicCode.trim() || undefined, chwId: chwId.trim() || undefined, consentedAt: new Date().toISOString() });
    router.push("/app");
  }

  if (step === "consent") {
    return (
      <main className="container">
        <h1>{t.onboardingWelcome}</h1>
        <p>{t.onboardingIntro}</p>

        <section className="card">
          <h2>{t.onboardingDataTitle}</h2>
          <p>{t.onboardingDataP1}</p>
          <p>{t.onboardingDataP2}</p>
          <ul>
            <li>{t.onboardingDataItem1}</li>
            <li>{t.onboardingDataItem2}</li>
            <li>{t.onboardingDataItem3}</li>
            <li>{t.onboardingDataItem4}</li>
          </ul>
          <p>{t.onboardingDataP3}</p>
        </section>

        <section className="card">
          <h2>{t.onboardingDisclaimerTitle}</h2>
          <p>{t.onboardingDisclaimerText}</p>
        </section>

        <label style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", fontWeight: "normal", cursor: "pointer" }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: "auto", marginTop: ".2rem" }} />
          <span>{t.onboardingConsentLabel}</span>
        </label>

        <button className="btn-primary btn-save" onClick={acceptConsent} disabled={!agreed}>
          {t.onboardingAcceptBtn}
        </button>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>{t.onboardingProfileTitle}</h1>
      <p>{t.onboardingProfileIntro}</p>

      <section className="card">
        <label>{t.onboardingClinicLabel} <span style={{ color: "#64748b", fontWeight: "normal" }}>{t.onboardingOptional}</span></label>
        <input
          value={clinicCode}
          onChange={(e) => setClinicCode(e.target.value)}
          placeholder="e.g. KAN-001"
          maxLength={40}
        />
        <label style={{ marginTop: "1rem" }}>{t.onboardingChwLabel} <span style={{ color: "#64748b", fontWeight: "normal" }}>{t.onboardingOptional}</span></label>
        <input
          value={chwId}
          onChange={(e) => setChwId(e.target.value)}
          placeholder="e.g. CHW-2024-042"
          maxLength={40}
        />
      </section>

      <button className="btn-primary btn-save" onClick={completeOnboarding}>
        {t.onboardingStartBtn}
      </button>
    </main>
  );
}
