"use client";

import { useEffect, useState } from "react";
import { evaluateTriage, clusterQuestions, type TriageInput, type TriageResult } from "@asibi/shared";
import { strings, type Lang, getSavedLang, saveLang, getAvailableLanguages, triageOutcomes } from "@/lib/i18n";

type Cluster = TriageInput["cluster"];
type FlagKey = keyof Omit<TriageInput, "cluster">;
type Phase = "entry" | "home" | "scenario" | "manual";
type ManualStep = "patient" | "cluster" | `q-${number}` | "result";

const riskColors: Record<string, string> = {
  monitor: "#2e7d32",
  treat_local: "#1565c0",
  refer: "#7b1fa2",
  urgent: "#e65100",
  emergency: "#b71c1c",
};

const riskLabelKeys: Record<string, keyof typeof strings.en> = {
  monitor: "risk_monitor",
  treat_local: "risk_treat_local",
  refer: "risk_refer",
  urgent: "risk_urgent",
  emergency: "risk_emergency",
};

const questionKeys: Record<FlagKey, keyof typeof strings.en> = {
  childUnderFive: "q_childUnderFive",
  unconscious: "q_unconscious",
  highFever: "q_highFever",
  severeDehydration: "q_severeDehydration",
  rainedHeavily: "q_rainedHeavily",
  breathingFast: "q_breathingFast",
  dustSmokeExposure: "q_dustSmokeExposure",
  persistentVomiting: "q_persistentVomiting",
  bloodInStool: "q_bloodInStool",
  seizures: "q_seizures",
  maternalDangerSigns: "q_maternalDangerSigns",
  malnutritionSigns: "q_malnutritionSigns",
};

interface DemoScenario {
  id: string;
  titleKey: keyof typeof strings.en;
  descKey: keyof typeof strings.en;
  patientKey: keyof typeof strings.en;
  input: TriageInput;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "heatstroke",
    titleKey: "demoScenarioHeatstroke",
    descKey: "demoScenarioHeatstrokeDesc",
    patientKey: "demoPatientHeatstroke",
    input: {
      cluster: "confusion_collapse",
      unconscious: true, highFever: true, seizures: false,
      childUnderFive: false, severeDehydration: false, rainedHeavily: false,
      breathingFast: false, dustSmokeExposure: false, persistentVomiting: false,
      bloodInStool: false, maternalDangerSigns: false, malnutritionSigns: false,
    },
  },
  {
    id: "malaria",
    titleKey: "demoScenarioMalaria",
    descKey: "demoScenarioMalariaDesc",
    patientKey: "demoPatientMalaria",
    input: {
      cluster: "fever",
      unconscious: false, seizures: false, childUnderFive: true,
      highFever: true, rainedHeavily: true, severeDehydration: false,
      breathingFast: false, dustSmokeExposure: false, persistentVomiting: false,
      bloodInStool: false, maternalDangerSigns: false, malnutritionSigns: false,
    },
  },
  {
    id: "waterborne",
    titleKey: "demoScenarioWaterborne",
    descKey: "demoScenarioWaterborneDesc",
    patientKey: "demoPatientWaterborne",
    input: {
      cluster: "vomiting_diarrhea",
      unconscious: false, severeDehydration: true, persistentVomiting: true,
      bloodInStool: true, rainedHeavily: true, childUnderFive: false,
      highFever: false, breathingFast: false, dustSmokeExposure: false,
      seizures: false, maternalDangerSigns: false, malnutritionSigns: false,
    },
  },
  {
    id: "respiratory",
    titleKey: "demoScenarioRespiratory",
    descKey: "demoScenarioRespiratoryDesc",
    patientKey: "demoPatientRespiratory",
    input: {
      cluster: "breathing",
      unconscious: false, breathingFast: true, childUnderFive: false,
      dustSmokeExposure: true, highFever: false, severeDehydration: false,
      rainedHeavily: false, persistentVomiting: false, bloodInStool: false,
      seizures: false, maternalDangerSigns: false, malnutritionSigns: false,
    },
  },
  {
    id: "mild",
    titleKey: "demoScenarioMild",
    descKey: "demoScenarioMildDesc",
    patientKey: "demoPatientMild",
    input: {
      cluster: "fever",
      unconscious: false, seizures: false, childUnderFive: false,
      highFever: false, rainedHeavily: false, severeDehydration: false,
      breathingFast: false, dustSmokeExposure: false, persistentVomiting: false,
      bloodInStool: false, maternalDangerSigns: false, malnutritionSigns: false,
    },
  },
];

const clusters: { value: Cluster; labelKey: keyof typeof strings.en }[] = [
  { value: "fever", labelKey: "clusterFever" },
  { value: "breathing", labelKey: "clusterBreathing" },
  { value: "vomiting_diarrhea", labelKey: "clusterVomiting" },
  { value: "confusion_collapse", labelKey: "clusterConfusion" },
  { value: "skin_rash", labelKey: "clusterRash" },
  { value: "other", labelKey: "clusterOther" },
];

const ageRangeOptions: { value: string; labelKey: keyof typeof strings.en }[] = [
  { value: "under_1", labelKey: "ageUnder1" },
  { value: "1_4", labelKey: "age1to4" },
  { value: "5_14", labelKey: "age5to14" },
  { value: "15_49", labelKey: "age15to49" },
  { value: "50_plus", labelKey: "age50plus" },
  { value: "unknown", labelKey: "ageUnknown" },
];

const sexOptions: { value: string; labelKey: keyof typeof strings.en }[] = [
  { value: "male", labelKey: "sexMale" },
  { value: "female", labelKey: "sexFemale" },
  { value: "other", labelKey: "sexOther" },
];

function buildManualSteps(cluster: Cluster | null): ManualStep[] {
  const base: ManualStep[] = ["patient", "cluster"];
  if (!cluster) return base;
  const qs = clusterQuestions[cluster] ?? [];
  return [...base, ...qs.map((_, i) => `q-${i}` as ManualStep), "result"];
}

const BANNER_DISMISS_KEY = "asibi_demo_banner_dismissed";
const BANNER_DISMISS_DURATION = 24 * 60 * 60 * 1000;

function isBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const ts = window.localStorage.getItem(BANNER_DISMISS_KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) < BANNER_DISMISS_DURATION;
}

export default function DemoPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [phase, setPhase] = useState<Phase>("entry");
  const [bannerVisible, setBannerVisible] = useState(false);
  // Scenario state
  const [activeScenario, setActiveScenario] = useState<DemoScenario | null>(null);
  // Manual triage state
  const [manualStep, setManualStep] = useState<ManualStep>("patient");
  const [manualCluster, setManualCluster] = useState<Cluster | null>(null);
  const [manualFlags, setManualFlags] = useState<Partial<Record<FlagKey, boolean>>>({});
  const [manualAgeRange, setManualAgeRange] = useState("unknown");
  const [manualSex, setManualSex] = useState("");
  const [manualResult, setManualResult] = useState<TriageResult | null>(null);

  useEffect(() => {
    setLang(getSavedLang());
    setBannerVisible(!isBannerDismissed());
  }, []);

  function changeLang(l: Lang) {
    setLang(l);
    saveLang(l);
  }

  function enterDemo() {
    setPhase("home");
  }

  function selectScenario(scenario: DemoScenario) {
    setActiveScenario(scenario);
    setPhase("scenario");
  }

  function backToHome() {
    setActiveScenario(null);
    setManualStep("patient");
    setManualCluster(null);
    setManualFlags({});
    setManualAgeRange("unknown");
    setManualSex("");
    setManualResult(null);
    setPhase("home");
  }

  function startManual() {
    setPhase("manual");
    setManualStep("patient");
  }

  const t = strings[lang];
  const tStr = t as Record<string, string>;

  // --- Scenario result view ---
  function ScenarioResult({ scenario }: { scenario: DemoScenario }) {
    const result = evaluateTriage(scenario.input);
    const relevantQs = clusterQuestions[scenario.input.cluster] ?? [];

    return (
      <div>
        <section className="card">
          <h2>{t.patientProfile}</h2>
          <p style={{ margin: 0, fontStyle: "italic", color: "#475569" }}>{tStr[scenario.patientKey]}</p>
        </section>

        <section className="card">
          <h2>{t.followUpTitle}</h2>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {relevantQs.map((qKey) => {
              const answered = scenario.input[qKey as FlagKey];
              return (
                <div
                  key={qKey}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                    background: answered ? "#f0fdf4" : "#f8fafc",
                    border: `1px solid ${answered ? "#86efac" : "#e2e8f0"}`,
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "0.9rem", color: "#334155", flex: 1 }}>
                    {tStr[questionKeys[qKey as FlagKey]]}
                  </span>
                  <span style={{
                    fontWeight: 700, fontSize: "0.85rem", flexShrink: 0,
                    color: answered ? "#166534" : "#94a3b8",
                  }}>
                    {answered ? t.yes : t.no}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <TriageResultCard result={result} t={t} lang={lang} />

        <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#94a3b8", margin: "0.5rem 0" }}>
          {t.demoNoSave}
        </p>
        <button className="btn-primary" style={{ width: "100%" }} onClick={backToHome}>
          {t.demoBackToScenarios}
        </button>
      </div>
    );
  }

  // --- Manual triage wizard ---
  function ManualTriage() {
    const steps = buildManualSteps(manualCluster);
    const currentIdx = steps.indexOf(manualStep);

    function goNext() {
      if (manualStep === "patient") {
        setManualStep("cluster");
        return;
      }
      if (manualStep === "cluster" && manualCluster) {
        const qs = clusterQuestions[manualCluster];
        setManualStep(qs.length > 0 ? "q-0" : "result");
        return;
      }
      if (manualStep.startsWith("q-")) {
        const idx = parseInt(manualStep.split("-")[1]);
        const qs = clusterQuestions[manualCluster!];
        if (idx + 1 < qs.length) {
          setManualStep(`q-${idx + 1}`);
        } else {
          const allFlags = Object.fromEntries(
            qs.map((k) => [k, manualFlags[k as FlagKey] ?? false])
          ) as Record<FlagKey, boolean>;
          const input: TriageInput = {
            cluster: manualCluster!,
            childUnderFive: allFlags.childUnderFive ?? false,
            unconscious: allFlags.unconscious ?? false,
            severeDehydration: allFlags.severeDehydration ?? false,
            highFever: allFlags.highFever ?? false,
            rainedHeavily: allFlags.rainedHeavily ?? false,
            breathingFast: allFlags.breathingFast ?? false,
            dustSmokeExposure: allFlags.dustSmokeExposure ?? false,
            persistentVomiting: allFlags.persistentVomiting ?? false,
            bloodInStool: allFlags.bloodInStool ?? false,
            seizures: allFlags.seizures ?? false,
            maternalDangerSigns: allFlags.maternalDangerSigns ?? false,
            malnutritionSigns: allFlags.malnutritionSigns ?? false,
          };
          setManualResult(evaluateTriage(input));
          setManualStep("result");
        }
      }
    }

    function goBack() {
      if (manualStep === "cluster") { setManualStep("patient"); return; }
      if (manualStep === "q-0") { setManualStep("cluster"); return; }
      if (manualStep.startsWith("q-")) {
        const idx = parseInt(manualStep.split("-")[1]);
        setManualStep(`q-${idx - 1}`);
        return;
      }
      if (manualStep === "result") {
        const qs = clusterQuestions[manualCluster!] ?? [];
        setManualStep(qs.length > 0 ? `q-${qs.length - 1}` : "cluster");
      }
    }

    function answerFlag(key: FlagKey, val: boolean) {
      setManualFlags((prev) => ({ ...prev, [key]: val }));
      setTimeout(goNext, 120);
    }

    if (manualStep === "patient") {
      return (
        <div>
          <p className="step-hint">{`${currentIdx + 1} / ${steps.length}`}</p>
          <h2>{t.patientProfile}</h2>
          <label>{t.ageRangeLabel}</label>
          <div className="btn-grid" style={{ marginBottom: "1rem" }}>
            {ageRangeOptions.map((opt) => (
              <button
                key={opt.value}
                className={`tap-btn${manualAgeRange === opt.value ? " selected" : ""}`}
                onClick={() => setManualAgeRange(opt.value)}
              >{tStr[opt.labelKey]}</button>
            ))}
          </div>
          <label>{t.sexLabel}</label>
          <div className="btn-grid" style={{ marginBottom: "1rem" }}>
            {sexOptions.map((opt) => (
              <button
                key={opt.value}
                className={`tap-btn${manualSex === opt.value ? " selected" : ""}`}
                onClick={() => setManualSex(opt.value)}
              >{tStr[opt.labelKey]}</button>
            ))}
          </div>
          <div className="btn-grid-2">
            <button onClick={backToHome}>{t.cancel}</button>
            <button className="btn-primary" onClick={goNext}>{t.next}</button>
          </div>
        </div>
      );
    }

    if (manualStep === "cluster") {
      return (
        <div>
          <p className="step-hint">{`${currentIdx + 1} / ${steps.length}`}</p>
          <h2>{t.selectCluster}</h2>
          <div className="btn-grid">
            {clusters.map((c) => (
              <button
                key={c.value}
                className={`tap-btn${manualCluster === c.value ? " selected" : ""}`}
                onClick={() => setManualCluster(c.value)}
              >{tStr[c.labelKey]}</button>
            ))}
          </div>
          <div className="btn-grid-2" style={{ marginTop: "1rem" }}>
            <button onClick={goBack}>{t.back}</button>
            <button className="btn-primary" onClick={goNext} disabled={!manualCluster}>{t.next}</button>
          </div>
        </div>
      );
    }

    if (manualStep.startsWith("q-") && manualCluster) {
      const qIdx = parseInt(manualStep.split("-")[1]);
      const qKey = clusterQuestions[manualCluster][qIdx] as FlagKey;
      return (
        <div>
          <p className="step-hint">{`${currentIdx + 1} / ${steps.length}`}</p>
          <h2>{t.followUpTitle}</h2>
          <p style={{ fontSize: "1.1rem", fontWeight: 600, margin: "1rem 0" }}>{tStr[questionKeys[qKey]]}</p>
          <div className="btn-grid-2">
            <button className="tap-btn tap-btn--yes" onClick={() => answerFlag(qKey, true)}>{t.yes}</button>
            <button className="tap-btn tap-btn--no" onClick={() => answerFlag(qKey, false)}>{t.no}</button>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button onClick={goBack} style={{ background: "none", color: "#64748b", border: "1px solid #e2e8f0" }}>
              {t.back}
            </button>
          </div>
        </div>
      );
    }

    if (manualStep === "result" && manualResult) {
      return (
        <div>
          <TriageResultCard result={manualResult} t={t} lang={lang} />
          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#94a3b8", margin: "0.5rem 0" }}>
            {t.demoNoSave}
          </p>
          <button className="btn-primary" style={{ width: "100%" }} onClick={backToHome}>
            {t.demoBackToScenarios}
          </button>
        </div>
      );
    }

    return null;
  }

  function dismissBanner() {
    window.localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()));
    setBannerVisible(false);
  }

  return (
    <div>
      {bannerVisible && (
        <div className="demo-banner">
          <span className="demo-banner-text">{t.demoBanner}</span>
          <button
            className="demo-banner-close"
            onClick={dismissBanner}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}
      <main className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h1 style={{ margin: 0, color: "var(--color-primary)" }}>Asibi</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: 0 }}>{t.language}</label>
            <select value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
              {getAvailableLanguages().map(({ code, name }) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {phase === "entry" && (
          <div style={{ textAlign: "center", paddingTop: "1.5rem" }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "0.5rem" }}>
              {t.triageTitle} — {t.demoLabel}
            </p>
            <p style={{ color: "#475569", marginBottom: "2rem", lineHeight: 1.6 }}>
              {t.demoDescription}
            </p>
            <button
              className="btn-primary"
              style={{ width: "100%", padding: "1.1rem", fontSize: "1.1rem", fontWeight: 700 }}
              onClick={enterDemo}
            >
              {t.enterDemo}
            </button>
          </div>
        )}

        {phase === "home" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <button
                className="btn-primary"
                style={{ width: "100%", padding: "0.9rem", fontSize: "1rem" }}
                onClick={startManual}
              >
                {t.demoManualTriage}
              </button>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
              <h2 style={{ marginBottom: "0.75rem" }}>{t.demoScenarios}</h2>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {DEMO_SCENARIOS.map((scenario) => {
                  const result = evaluateTriage(scenario.input);
                  return (
                    <button
                      key={scenario.id}
                      className="scenario-card"
                      onClick={() => selectScenario(scenario)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <div>
                          <h3>{tStr[scenario.titleKey]}</h3>
                          <p>{tStr[scenario.descKey]}</p>
                        </div>
                        <span
                          className="result-badge"
                          style={{ background: riskColors[result.riskLevel], fontSize: "0.75rem", padding: "0.3rem 0.65rem", whiteSpace: "nowrap" }}
                        >
                          {tStr[riskLabelKeys[result.riskLevel]]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === "scenario" && activeScenario && (
          <ScenarioResult scenario={activeScenario} />
        )}

        {phase === "manual" && (
          <ManualTriage />
        )}
      </main>
    </div>
  );
}

function TriageResultCard({ result, t, lang }: { result: TriageResult; t: (typeof strings)[Lang]; lang: Lang }) {
  const localized = triageOutcomes[lang][result.outcomeKey];
  const localCondition = localized?.likelyCondition ?? result.likelyCondition;
  const localRecommendation = localized?.recommendation ?? result.recommendation;
  const localCareAdvice = localized?.careAdvice ?? result.careAdvice;
  const localRedFlags = localized?.redFlags ?? result.redFlags;
  return (
    <section className="card" style={{ borderColor: riskColors[result.riskLevel] }}>
      <h2>{t.resultTitle}</h2>
      <p><strong>{t.riskLevel}:</strong></p>
      <span className="result-badge" style={{ background: riskColors[result.riskLevel] }}>
        {(t as Record<string, string>)[riskLabelKeys[result.riskLevel]]}
      </span>
      <p><strong>{t.likelyCondition}:</strong> {localCondition}</p>
      <p><strong>{t.recommendation}:</strong> {localRecommendation}</p>
      {localRedFlags.length > 0 && (
        <div className="card card--danger" style={{ margin: "0.5rem 0" }}>
          <h2>{t.redFlags}</h2>
          <ul>{localRedFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}
      <p><strong>{t.careAdvice}:</strong> {localCareAdvice}</p>
      <p>{result.referralRequired ? t.referralRequired : t.noReferral}</p>
      <p className="disclaimer">{t.disclaimer}</p>
    </section>
  );
}
