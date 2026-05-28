"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ModuleResult, ActionTaken, ViaClassification, ConfidenceBand } from "@daghe/shared";
import { applyConfidenceOverride } from "@daghe/shared";
import { cervicalViaModule } from "@daghe/cervical-via";
import { runQualityChecks } from "@/lib/ai/quality-check";
import { runTFLiteInference } from "@/lib/ai/tflite-runner";
import { saveEncounter } from "@/lib/encounters";
import { strings, getSavedLang, type Lang } from "@/lib/i18n";
import type { ConditionModule } from "@daghe/shared";

type Step =
  | "module-select"
  | "patient-context"
  | "capture-guide"
  | "capture"
  | "quality-check"
  | "inference"
  | "result"
  | "action-taken";

type PatientContext = {
  ageBand: string;
  screeningContext: "routine" | "referral" | "hpv-positive-triage";
};

type FallbackAnswers = {
  white_patch?: "yes" | "no" | "unsure";
  patch_touches_os?: "yes" | "no" | "not_applicable";
  patch_raised_or_irregular?: "yes" | "no" | "unsure";
};

const AGE_BANDS = ["<25", "25–34", "35–44", "45–54", "55+"];

const BAND_COLORS: Record<ConfidenceBand, { bg: string; text: string; label: string }> = {
  HIGH: { bg: "#d1fae5", text: "#065f46", label: "HIGH CONFIDENCE" },
  MODERATE: { bg: "#fef3c7", text: "#92400e", label: "MODERATE CONFIDENCE" },
  LOW: { bg: "#fee2e2", text: "#991b1b", label: "LOW CONFIDENCE" },
  REFERENCE_ONLY: { bg: "#f3f4f6", text: "#374151", label: "REFERENCE ONLY" },
};

const CLASS_COLORS: Record<ViaClassification, { bg: string; text: string; icon: string }> = {
  POSITIVE: { bg: "#fee2e2", text: "#991b1b", icon: "⚠" },
  NEGATIVE: { bg: "#d1fae5", text: "#065f46", icon: "✓" },
  REFER: { bg: "#fef3c7", text: "#92400e", icon: "→" },
};

function applyFallbackRules(answers: FallbackAnswers): ModuleResult {
  const { white_patch, patch_touches_os, patch_raised_or_irregular } = answers;

  let classification: ViaClassification = "REFER";
  let confidenceBand: ConfidenceBand = "MODERATE";
  let recommendedAction = "Escalate to supervising clinician.";

  if (white_patch === "no") {
    classification = "NEGATIVE";
    recommendedAction = "Routine rescreening in 3 years.";
  } else if (white_patch === "unsure") {
    classification = "REFER";
    recommendedAction = "Refer for clinical assessment — unable to determine.";
  } else if (white_patch === "yes") {
    if (patch_touches_os === "yes" || patch_raised_or_irregular === "yes") {
      classification = "POSITIVE";
      recommendedAction = "Refer for colposcopy or consider same-visit cryotherapy if eligible.";
    } else {
      classification = "REFER";
      recommendedAction = "White patch present but no high-risk features — refer for further assessment.";
    }
  }

  const result: ModuleResult = {
    classification,
    confidenceBand,
    inferenceMethod: "rule-based",
    confidenceSentence: "Offline rule-based result. Image analysis was not available.",
    recommendedAction,
    referralRequired: classification !== "NEGATIVE",
    qualityOverrideUsed: false,
  };

  return applyConfidenceOverride(result);
}

export default function ScreeningPage() {
  const [lang, setLang] = useState<Lang>("en");
  // Cast to English string type — Daghe-specific keys exist in en only until Phase 5 i18n completion
  const t = strings[lang] as typeof strings.en;
  const router = useRouter();

  useEffect(() => {
    setLang(getSavedLang());
  }, []);
  const [step, setStep] = useState<Step>("module-select");
  const [selectedModule] = useState<ConditionModule>(cervicalViaModule);
  const [patientCtx, setPatientCtx] = useState<PatientContext>({
    ageBand: "25–34",
    screeningContext: "routine",
  });
  const [qualityAttempts, setQualityAttempts] = useState(0);
  const [qualityMessage, setQualityMessage] = useState("");
  const [inferenceStatus, setInferenceStatus] = useState("");
  const [result, setResult] = useState<ModuleResult | null>(null);
  const [actionTaken, setActionTaken] = useState<ActionTaken>("referred");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [fallbackAnswers, setFallbackAnswers] = useState<FallbackAnswers>({});
  const [showFallback, setShowFallback] = useState(false);
  const [estimatedCostUsd, setEstimatedCostUsd] = useState<string | null>(null);

  // Image MUST be in a ref, never React state — PRD requirement
  const imageDataRef = useRef<ImageData | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean up camera and image on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      imageDataRef.current = null;
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // Camera unavailable — show upload fallback
    }
  }

  function captureFrame(): ImageData | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.drawImage(img, 0, 0);
      imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      stopCamera();
      void runQualityAndInference(imageDataRef.current, false);
    };
    img.src = url;
  }

  async function handleCapture() {
    const frame = captureFrame();
    if (!frame) return;
    imageDataRef.current = frame;
    stopCamera();
    setStep("quality-check");
    await runQualityAndInference(frame, false);
  }

  async function handleContinueAnyway() {
    const frame = imageDataRef.current;
    if (!frame) return;
    setStep("inference");
    await runInference(frame, true);
  }

  async function runQualityAndInference(frame: ImageData, qualityOverride: boolean) {
    setStep("quality-check");
    setQualityMessage(t.qualityCheckRunning ?? "Checking image quality…");

    const qResult = runQualityChecks(frame, selectedModule, null);
    if (!qResult.ok && !qualityOverride) {
      const msgs: Record<string, string> = {
        blur: t.qualityBlur ?? "Image blurry",
        exposure: t.qualityExposure ?? "Exposure issue",
        framing: t.qualityFraming ?? "Framing issue",
      };
      setQualityMessage(msgs[qResult.reason] ?? "Quality check failed");
      setQualityAttempts(prev => prev + 1);
      return;
    }

    setStep("inference");
    await runInference(frame, qualityOverride);
  }

  async function runInference(frame: ImageData, qualityOverride: boolean) {
    setInferenceStatus(t.analysing ?? "Analysing image…");

    // Step 1: TFLite on-device
    const tfliteResult = await runTFLiteInference(frame, selectedModule);
    if (tfliteResult) {
      const final = { ...tfliteResult, qualityOverrideUsed: qualityOverride };
      setResult(final);
      setStep("result");
      // Clear image from memory after inference
      imageDataRef.current = null;
      return;
    }

    // Step 2: Cloud AI (Gemini → GPT-4o)
    if (navigator.onLine) {
      setInferenceStatus(t.inferenceOnline ?? "Online AI analysis…");
      try {
        // Convert ImageData to base64 JPEG for the API call
        const canvas = document.createElement("canvas");
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext("2d")!;
        ctx.putImageData(frame, 0, 0);
        const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1]!;

        const res = await fetch("/api/ai/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            moduleId: selectedModule.id,
            encounterId: crypto.randomUUID(),
            patientAgeBand: patientCtx.ageBand,
            screeningContext: patientCtx.screeningContext,
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (res.ok) {
          const json = await res.json() as {
            data?: {
              classification?: ViaClassification;
              confidenceBand?: ConfidenceBand;
              confidenceScore?: number;
              confidenceSentence?: string;
              recommendedAction?: string;
              inferenceMethod?: ModuleResult["inferenceMethod"];
              estimatedCostUsd?: string;
            };
          };
          const d = json.data;
          if (d?.classification && d.confidenceBand) {
            const cloudResult: ModuleResult = {
              classification: d.classification,
              confidenceBand: d.confidenceBand,
              inferenceMethod: d.inferenceMethod ?? "gemini",
              confidenceScore: d.confidenceScore,
              confidenceSentence: d.confidenceSentence ?? "",
              recommendedAction: d.recommendedAction ?? "",
              referralRequired: d.classification !== "NEGATIVE",
              qualityOverrideUsed: qualityOverride,
            };
            const final = applyConfidenceOverride(cloudResult);
            setResult(final);
            if (d.estimatedCostUsd) setEstimatedCostUsd(d.estimatedCostUsd);
            setStep("result");
            imageDataRef.current = null;
            return;
          }
        }
      } catch {
        // Cloud AI failed — fall through to offline rule-based
      }
    }

    // Step 3: Offline rule-based fallback
    imageDataRef.current = null;
    setShowFallback(true);
  }

  function handleFallbackAnswer(qId: keyof FallbackAnswers, value: string) {
    setFallbackAnswers(prev => ({ ...prev, [qId]: value as never }));
  }

  function handleFallbackSubmit() {
    const fallbackResult = applyFallbackRules(fallbackAnswers);
    setResult(fallbackResult);
    setShowFallback(false);
    setStep("result");
  }

  async function handleSave() {
    if (!result) return;
    const id = crypto.randomUUID();
    await saveEncounter({
      id,
      facilityId: null,
      userId: null,
      moduleId: selectedModule.id,
      patientAgeBand: patientCtx.ageBand,
      screeningContext: patientCtx.screeningContext,
      result,
      imageHash: null,
      actionTaken,
      qualityOverride: result.qualityOverrideUsed,
      inferenceMethod: result.inferenceMethod,
      appVersion: "0.1.0",
      moduleVersion: selectedModule.version,
      deviceLocalTime: new Date().toISOString(),
      utcTime: new Date().toISOString(),
      syncStatus: "pending",
      retryCount: 0,
      isDemoEncounter: false,
      notes: notes || undefined,
    });
    setSaved(true);
  }

  function handleNewScreening() {
    imageDataRef.current = null;
    setStep("module-select");
    setResult(null);
    setSaved(false);
    setQualityAttempts(0);
    setQualityMessage("");
    setFallbackAnswers({});
    setShowFallback(false);
    setEstimatedCostUsd(null);
    setNotes("");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === "module-select") {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
          {t.moduleSelect ?? "Select Screening Type"}
        </h1>
        <button
          onClick={() => setStep("patient-context")}
          aria-label={t.cervicalVia ?? "Cervical Cancer Screening (VIA)"}
          style={{
            display: "block",
            width: "100%",
            padding: "1rem",
            background: "#eff6ff",
            border: "2px solid #3b82f6",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {t.cervicalVia ?? "Cervical Cancer Screening (VIA)"}
        </button>
      </main>
    );
  }

  if (step === "patient-context") {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
          {t.patientAgeBand ?? "Patient Age Range"}
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {AGE_BANDS.map(band => (
            <button
              key={band}
              onClick={() => setPatientCtx(p => ({ ...p, ageBand: band }))}
              aria-pressed={patientCtx.ageBand === band}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: patientCtx.ageBand === band ? "2px solid #2563eb" : "1px solid #d1d5db",
                background: patientCtx.ageBand === band ? "#dbeafe" : "#fff",
                fontWeight: patientCtx.ageBand === band ? 700 : 400,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              {band}
            </button>
          ))}
        </div>

        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          {t.screeningContext ?? "Screening Reason"}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.5rem" }}>
          {(["routine", "referral", "hpv-positive-triage"] as const).map(ctx => {
            const labels: Record<string, string> = {
              routine: t.screeningRoutine ?? "Routine screening",
              referral: t.screeningReferral ?? "Referral",
              "hpv-positive-triage": t.screeningHpv ?? "HPV-positive triage",
            };
            return (
              <button
                key={ctx}
                onClick={() => setPatientCtx(p => ({ ...p, screeningContext: ctx }))}
                aria-pressed={patientCtx.screeningContext === ctx}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: patientCtx.screeningContext === ctx ? "2px solid #2563eb" : "1px solid #d1d5db",
                  background: patientCtx.screeningContext === ctx ? "#dbeafe" : "#fff",
                  fontWeight: patientCtx.screeningContext === ctx ? 700 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  minHeight: 44,
                }}
              >
                {labels[ctx]}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setStep("capture-guide")}
          style={{
            display: "block",
            width: "100%",
            padding: "12px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          Continue
        </button>
      </main>
    );
  }

  if (step === "capture-guide") {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
          {t.captureGuideTitle ?? "Image Capture Guide"}
        </h1>
        <ul style={{ marginBottom: "1.5rem", paddingLeft: "1.25rem", lineHeight: 1.8 }}>
          <li>Ensure adequate lighting (not too dark, not too bright)</li>
          <li>Hold device steady — avoid motion blur</li>
          <li>Centre the cervix in the frame</li>
          <li>Apply acetic acid first and wait 60 seconds</li>
          <li>Capture within 2 minutes of acetic acid application</li>
        </ul>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => { setStep("capture"); void startCamera(); }}
            aria-label={t.captureImage ?? "Capture Image"}
            style={{
              flex: 1,
              padding: "12px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {t.captureImage ?? "Capture Image"}
          </button>
          <button
            onClick={() => setStep("capture")}
            aria-label={t.skipCertified ?? "Skip — I'm certified"}
            style={{
              flex: 1,
              padding: "12px",
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: "0.9rem",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {t.skipCertified ?? "Skip — I'm certified"}
          </button>
        </div>
      </main>
    );
  }

  if (step === "capture") {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
          {t.captureImage ?? "Capture Image"}
        </h1>
        <div style={{ position: "relative", background: "#000", borderRadius: 8, overflow: "hidden", marginBottom: "1rem", aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Camera preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onLoadedMetadata={() => { void videoRef.current?.play(); }}
          />
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => { void handleCapture(); }}
            aria-label={t.captureImage ?? "Capture Image"}
            style={{
              padding: "14px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {t.captureImage ?? "Capture Image"}
          </button>
          <label
            aria-label={t.uploadImage ?? "Upload from Gallery"}
            style={{
              display: "block",
              padding: "12px",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
              minHeight: 44,
              lineHeight: "20px",
            }}
          >
            {t.uploadImage ?? "Upload from Gallery"}
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
        </div>
      </main>
    );
  }

  if (step === "quality-check") {
    const canOverride = qualityAttempts >= 3;
    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontSize: "1rem", marginBottom: "1.5rem" }}>{qualityMessage}</p>
        {qualityMessage !== (t.qualityCheckRunning ?? "Checking image quality…") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => { setStep("capture"); void startCamera(); }}
              style={{
                padding: "12px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: "1rem",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Retake Image
            </button>
            {canOverride && (
              <button
                onClick={() => { void handleContinueAnyway(); }}
                aria-label={t.qualityOverride ?? "Continue anyway"}
                style={{
                  padding: "12px",
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #f59e0b",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                {t.qualityOverride ?? "Continue anyway — result confidence may be lower"}
              </button>
            )}
          </div>
        )}
      </main>
    );
  }

  if (step === "inference" && !showFallback) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontSize: "1rem" }}>{inferenceStatus || (t.analysing ?? "Analysing image…")}</p>
      </main>
    );
  }

  if (showFallback) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
          {t.ruleBasedLabel ?? "RULE-BASED RESULT — No image analysis performed"}
        </div>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>Offline clinical questions</h1>

        <p style={{ fontWeight: 600, marginBottom: 8 }}>Do you see a white patch (acetowhite area) on the cervix?</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["yes", "no", "unsure"].map(v => (
            <button key={v} onClick={() => handleFallbackAnswer("white_patch", v)}
              aria-pressed={fallbackAnswers.white_patch === v}
              style={{ flex: 1, padding: "10px", border: fallbackAnswers.white_patch === v ? "2px solid #2563eb" : "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", background: fallbackAnswers.white_patch === v ? "#dbeafe" : "#fff", minHeight: 44, textTransform: "capitalize" }}>
              {v}
            </button>
          ))}
        </div>

        {fallbackAnswers.white_patch === "yes" && (
          <>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Does the white patch touch or surround the cervical os?</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["yes", "no", "not_applicable"].map(v => (
                <button key={v} onClick={() => handleFallbackAnswer("patch_touches_os", v)}
                  aria-pressed={fallbackAnswers.patch_touches_os === v}
                  style={{ flex: 1, padding: "10px", border: fallbackAnswers.patch_touches_os === v ? "2px solid #2563eb" : "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", background: fallbackAnswers.patch_touches_os === v ? "#dbeafe" : "#fff", minHeight: 44, fontSize: 12 }}>
                  {v.replace("_", " ")}
                </button>
              ))}
            </div>

            <p style={{ fontWeight: 600, marginBottom: 8 }}>Is the white patch raised or irregular in border?</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["yes", "no", "unsure"].map(v => (
                <button key={v} onClick={() => handleFallbackAnswer("patch_raised_or_irregular", v)}
                  aria-pressed={fallbackAnswers.patch_raised_or_irregular === v}
                  style={{ flex: 1, padding: "10px", border: fallbackAnswers.patch_raised_or_irregular === v ? "2px solid #2563eb" : "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", background: fallbackAnswers.patch_raised_or_irregular === v ? "#dbeafe" : "#fff", minHeight: 44, textTransform: "capitalize" }}>
                  {v}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={handleFallbackSubmit}
          disabled={!fallbackAnswers.white_patch}
          style={{
            width: "100%",
            padding: "12px",
            background: fallbackAnswers.white_patch ? "#2563eb" : "#9ca3af",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            cursor: fallbackAnswers.white_patch ? "pointer" : "not-allowed",
            minHeight: 44,
          }}
        >
          Get Result
        </button>
      </main>
    );
  }

  if (step === "result" && result) {
    const classStyle = CLASS_COLORS[result.classification];
    const bandStyle = BAND_COLORS[result.confidenceBand];
    const inferenceLabels: Record<string, string> = {
      tflite: t.inferenceOnDevice ?? "On-device AI",
      gemini: t.inferenceOnline ?? "Online AI",
      gpt4o: t.inferenceOnline ?? "Online AI",
      "rule-based": t.inferenceRuleBased ?? "Offline guidance",
      reference: t.inferenceReference ?? "Reference only",
    };

    return (
      <main style={{ padding: "1.5rem", maxWidth: 480, margin: "0 auto" }}>
        {/* Classification badge */}
        <div
          role="status"
          aria-label={`Classification: ${result.classification}`}
          style={{
            background: classStyle.bg,
            color: classStyle.text,
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: "1.5rem",
            fontWeight: 800,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "1.75rem" }}>{classStyle.icon}</span>
          {result.classification}
        </div>

        {/* Confidence band — always visible, never hidden */}
        <div
          role="status"
          aria-label={`Confidence: ${result.confidenceBand}`}
          style={{
            background: bandStyle.bg,
            color: bandStyle.text,
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 12,
            fontWeight: 700,
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
          }}
        >
          {bandStyle.label}
          {result.confidenceScore !== undefined && (
            <span style={{ fontWeight: 400, marginInlineStart: 8 }}>
              ({Math.round(result.confidenceScore * 100)}%)
            </span>
          )}
        </div>

        {/* Chips row: inference method + cost */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ background: "#f3f4f6", color: "#374151", padding: "4px 10px", borderRadius: 20, fontSize: 12 }}>
            {inferenceLabels[result.inferenceMethod] ?? result.inferenceMethod}
          </span>
          {result.qualityOverrideUsed && (
            <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: 20, fontSize: 12 }}>
              Quality override
            </span>
          )}
          {estimatedCostUsd && (
            <span style={{ background: "#f0fdf4", color: "#166534", padding: "4px 10px", borderRadius: 20, fontSize: 12 }}>
              {t.onlineAiCost ?? "estimated cost"}: ${estimatedCostUsd}
            </span>
          )}
        </div>

        {/* Confidence sentence */}
        <p style={{ fontSize: "0.9rem", color: "#374151", marginBottom: 12 }}>{result.confidenceSentence}</p>

        {/* Recommended action */}
        <div style={{ background: "#f8fafc", borderLeft: "4px solid #2563eb", padding: "12px 16px", borderRadius: "0 8px 8px 0", marginBottom: 20 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Recommended action</p>
          <p style={{ fontSize: "0.9rem" }}>{result.recommendedAction}</p>
        </div>

        {/* Action taken selector */}
        {!saved && (
          <>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Action taken</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {(["treated", "referred", "monitored", "declined"] as ActionTaken[]).map(a => {
                const labels: Record<ActionTaken, string> = {
                  treated: t.actionTreated ?? "Treated",
                  referred: t.actionReferred ?? "Referred",
                  monitored: t.actionMonitored ?? "Monitored",
                  declined: t.actionDeclined ?? "Declined",
                };
                return (
                  <button
                    key={a}
                    onClick={() => setActionTaken(a)}
                    aria-pressed={actionTaken === a}
                    style={{
                      padding: "8px 16px",
                      border: actionTaken === a ? "2px solid #2563eb" : "1px solid #d1d5db",
                      borderRadius: 20,
                      background: actionTaken === a ? "#dbeafe" : "#fff",
                      cursor: "pointer",
                      minHeight: 44,
                    }}
                  >
                    {labels[a]}
                  </button>
                );
              })}
            </div>

            <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>
              {t.notesLabel ?? "Notes (optional)"}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", resize: "vertical" }}
              />
            </label>
            <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
              {t.notesDisclaimer ?? "Notes are stored on this device only and never uploaded."}
            </p>

            <button
              onClick={() => { void handleSave(); }}
              aria-label={t.saveEncounter ?? "Save Encounter"}
              style={{
                display: "block",
                width: "100%",
                padding: "12px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
                marginBottom: 10,
              }}
            >
              {t.saveEncounter ?? "Save Encounter"}
            </button>
          </>
        )}

        {saved && (
          <p role="status" style={{ color: "#059669", fontWeight: 600, marginBottom: 16 }}>
            {t.encounterSaved ?? "Encounter saved."}
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleNewScreening}
            aria-label={t.newScreening ?? "New Screening"}
            style={{
              flex: 1,
              padding: "12px",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {t.newScreening ?? "New Screening"}
          </button>
          <button
            onClick={() => router.push("/encounters")}
            style={{
              flex: 1,
              padding: "12px",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {t.encounters ?? "Case Log"}
          </button>
        </div>
      </main>
    );
  }

  return null;
}
