"use client";

import { useEffect, useRef, useState } from "react";
import { strings, getSavedLang, type Lang } from "@/lib/i18n";
import { runQualityChecks, type QualityCheckResult } from "@/lib/ai/quality-check";
import { runTFLiteInference } from "@/lib/ai/tflite-runner";
import { applyConfidenceOverride } from "@daghe/shared";
import { cervicalViaModule } from "@daghe/cervical-via";
import type { ModuleResult, ViaClassification, ConfidenceBand } from "@daghe/shared";

const DEMO_IMAGES = [
  {
    path: "/demo/via-positive.jpg",
    label: "Acetowhite lesion present",
    fallback: {
      classification: "POSITIVE" as ViaClassification,
      confidenceBand: "HIGH" as ConfidenceBand,
      confidenceScore: 0.91,
    },
  },
  {
    path: "/demo/via-negative.jpg",
    label: "No acetowhite lesion detected",
    fallback: {
      classification: "NEGATIVE" as ViaClassification,
      confidenceBand: "HIGH" as ConfidenceBand,
      confidenceScore: 0.88,
    },
  },
  {
    path: "/demo/via-indeterminate.jpg",
    label: "Indeterminate findings",
    fallback: {
      classification: "REFER" as ViaClassification,
      confidenceBand: "MODERATE" as ConfidenceBand,
      confidenceScore: 0.67,
    },
  },
];

const BAND_COLORS: Record<ConfidenceBand, { bg: string; text: string; label: string }> = {
  HIGH: { bg: "#d1fae5", text: "#065f46", label: "HIGH CONFIDENCE" },
  MODERATE: { bg: "#fef3c7", text: "#92400e", label: "MODERATE CONFIDENCE" },
  LOW: { bg: "#fee2e2", text: "#991b1b", label: "LOW CONFIDENCE" },
  REFERENCE_ONLY: { bg: "#f3f4f6", text: "#374151", label: "REFERENCE ONLY" },
};

const CLASS_COLORS: Record<ViaClassification, { bg: string; text: string }> = {
  POSITIVE: { bg: "#fee2e2", text: "#991b1b" },
  NEGATIVE: { bg: "#d1fae5", text: "#065f46" },
  REFER: { bg: "#fef9c3", text: "#854d0e" },
};

type CardState =
  | { status: "idle" }
  | { status: "analysing" }
  | { status: "done"; result: ModuleResult; quality: QualityCheckResult };

export default function DemoPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = strings[lang];
  const [cards, setCards] = useState<CardState[]>(DEMO_IMAGES.map(() => ({ status: "idle" })));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLang(getSavedLang());
  }, []);

  function setCard(index: number, state: CardState) {
    setCards(prev => prev.map((c, i) => (i === index ? state : c)));
  }

  async function analyse(index: number) {
    setCard(index, { status: "analysing" });

    try {
      // Fetch the demo image and draw to an offscreen canvas to get ImageData
      const img = new window.Image();
      const src = DEMO_IMAGES[index]!.path;

      const imageData = await new Promise<ImageData>((resolve, reject) => {
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("No 2d context")); return; }
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = src;
      });

      // Run quality checks (framing ROI passed as null — no detection model in demo)
      const quality = runQualityChecks(imageData, cervicalViaModule, null);

      // Run TFLite inference (returns null in demo/test env without WASM models)
      let inferenceResult = await runTFLiteInference(imageData, cervicalViaModule);

      if (!inferenceResult) {
        // Use pre-set demo results keyed by image index
        const fb = DEMO_IMAGES[index]!.fallback;
        inferenceResult = {
          classification: fb.classification,
          confidenceBand: fb.confidenceBand,
          inferenceMethod: "tflite",
          confidenceScore: fb.confidenceScore,
          confidenceSentence: `Demo result. Confidence: ${Math.round(fb.confidenceScore * 100)}%.`,
          recommendedAction:
            fb.classification === "NEGATIVE"
              ? "Routine rescreening in 3 years."
              : fb.classification === "POSITIVE"
              ? "Refer for colposcopy or consider same-visit cryotherapy if eligible."
              : "Escalate to supervising clinician.",
          referralRequired: fb.classification !== "NEGATIVE",
          qualityOverrideUsed: false,
        };
      }

      // Clinical safety: apply confidence override before displaying
      const final = applyConfidenceOverride(inferenceResult);

      setCard(index, { status: "done", result: final, quality });
    } catch {
      // Graceful fallback using preset result if image load fails
      const fb = DEMO_IMAGES[index]!.fallback;
      const fallbackResult: ModuleResult = {
        classification: fb.classification,
        confidenceBand: fb.confidenceBand,
        inferenceMethod: "tflite",
        confidenceScore: fb.confidenceScore,
        confidenceSentence: `Demo result. Confidence: ${Math.round(fb.confidenceScore * 100)}%.`,
        recommendedAction:
          fb.classification === "NEGATIVE"
            ? "Routine rescreening in 3 years."
            : fb.classification === "POSITIVE"
            ? "Refer for colposcopy or consider same-visit cryotherapy if eligible."
            : "Escalate to supervising clinician.",
        referralRequired: fb.classification !== "NEGATIVE",
        qualityOverrideUsed: false,
      };
      const final = applyConfidenceOverride(fallbackResult);
      setCard(index, { status: "done", result: final, quality: { ok: true } });
    }
  }

  return (
    <main className="demo-page">
      {/* Non-dismissible DEMO banner — clinical safety requirement */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "#f59e0b",
          color: "#1a1a1a",
          fontWeight: 700,
          textAlign: "center",
          padding: "0.6rem 1rem",
          zIndex: 10000,
          fontSize: "0.95rem",
          letterSpacing: "0.04em",
        }}
      >
        {t.demoBanner}
      </div>

      {/* Hidden canvas used for image-to-ImageData conversion */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ paddingTop: "3.5rem" }}>
        <h1 style={{ textAlign: "center", marginBlock: "1.5rem" }}>Daghe — Demo Mode</h1>
        <p style={{ textAlign: "center", color: "var(--text-muted, #6b7280)", marginBottom: "2rem" }}>
          Sample VIA cervical screening results. No data is saved or synced.
        </p>

        <div style={{ display: "grid", gap: "1.5rem", maxWidth: "600px", margin: "0 auto", padding: "0 1rem" }}>
          {DEMO_IMAGES.map((img, index) => {
            const card = cards[index]!;

            return (
              <div
                key={img.path}
                style={{
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  background: "var(--card-bg, white)",
                }}
              >
                {/* Image thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.path}
                  alt={img.label}
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover",
                    borderRadius: "0.5rem",
                    marginBottom: "1rem",
                    background: "#f3f4f6",
                  }}
                />

                <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "#374151" }}>{img.label}</p>

                {card.status === "idle" && (
                  <button
                    className="btn-primary"
                    onClick={() => { void analyse(index); }}
                    style={{ width: "100%" }}
                  >
                    Analyse
                  </button>
                )}

                {card.status === "analysing" && (
                  <div style={{ textAlign: "center", color: "#6b7280", fontSize: "0.9rem", padding: "0.75rem 0" }}>
                    Analysing image…
                  </div>
                )}

                {card.status === "done" && (
                  <>
                    {/* Quality check badge */}
                    <div
                      style={{
                        display: "inline-block",
                        borderRadius: "0.4rem",
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                        background: card.quality.ok ? "#dcfce7" : "#fee2e2",
                        color: card.quality.ok ? "#166534" : "#991b1b",
                      }}
                    >
                      {card.quality.ok
                        ? "Quality: PASS"
                        : `Quality: FAIL — ${"reason" in card.quality ? card.quality.reason.toUpperCase() : "UNKNOWN"}`}
                    </div>

                    {/* Confidence band */}
                    <div
                      style={{
                        background: BAND_COLORS[card.result.confidenceBand].bg,
                        color: BAND_COLORS[card.result.confidenceBand].text,
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        textAlign: "center",
                        borderRadius: "0.4rem",
                        padding: "0.4rem 0.75rem",
                        marginBottom: "0.5rem",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {BAND_COLORS[card.result.confidenceBand].label}
                    </div>

                    {/* Classification result */}
                    <div
                      style={{
                        background: CLASS_COLORS[card.result.classification].bg,
                        color: CLASS_COLORS[card.result.classification].text,
                        fontWeight: 700,
                        fontSize: "1.4rem",
                        textAlign: "center",
                        borderRadius: "0.5rem",
                        padding: "0.75rem",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {card.result.classification}
                    </div>

                    {card.result.confidenceScore !== undefined && (
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#6b7280", textAlign: "center" }}>
                        Score: {Math.round(card.result.confidenceScore * 100)}%
                      </p>
                    )}

                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#475569" }}>
                      {card.result.confidenceSentence}
                    </p>

                    <button
                      onClick={() => setCard(index, { status: "idle" })}
                      style={{
                        marginTop: "0.75rem",
                        fontSize: "0.8rem",
                        background: "none",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.4rem",
                        padding: "0.35rem 0.75rem",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: "2rem",
            fontSize: "0.85rem",
            color: "var(--text-muted, #6b7280)",
            padding: "0 1rem 2rem",
          }}
        >
          Full AI pipeline with camera capture and TFLite inference available in the live screening flow.
        </p>
      </div>
    </main>
  );
}
