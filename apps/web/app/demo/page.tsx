"use client";

import { useEffect, useState } from "react";
import { strings, getSavedLang, type Lang } from "@/lib/i18n";

const DEMO_IMAGES = [
  { path: "/demo/via-positive.jpg", label: "Acetowhite lesion present", result: "POSITIVE" as const },
  { path: "/demo/via-negative.jpg", label: "No acetowhite lesion detected", result: "NEGATIVE" as const },
  { path: "/demo/via-indeterminate.jpg", label: "Indeterminate findings", result: "REFER" as const },
];

const resultColors: Record<string, { bg: string; text: string }> = {
  POSITIVE: { bg: "#fee2e2", text: "#991b1b" },
  NEGATIVE: { bg: "#dcfce7", text: "#166534" },
  REFER: { bg: "#fef9c3", text: "#854d0e" },
};

export default function DemoPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = strings[lang];

  useEffect(() => {
    setLang(getSavedLang());
  }, []);

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

      <div style={{ paddingTop: "3.5rem" }}>
        <h1 style={{ textAlign: "center", marginBlock: "1.5rem" }}>Daghe — Demo Mode</h1>
        <p style={{ textAlign: "center", color: "var(--text-muted, #6b7280)", marginBottom: "2rem" }}>
          Sample VIA cervical screening results. No data is saved or synced.
        </p>

        <div style={{ display: "grid", gap: "1.5rem", maxWidth: "600px", margin: "0 auto", padding: "0 1rem" }}>
          {DEMO_IMAGES.map((img) => {
            const colors = resultColors[img.result];
            return (
              <div
                key={img.result}
                style={{
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  background: "var(--card-bg, white)",
                }}
              >
                <div
                  style={{
                    background: colors.bg,
                    color: colors.text,
                    fontWeight: 700,
                    fontSize: "1.4rem",
                    textAlign: "center",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    marginBottom: "0.75rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  {img.result}
                </div>
                <div
                  style={{
                    background: "#f1f5f9",
                    borderRadius: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.85rem",
                    color: "#475569",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                  }}
                >
                  MODERATE CONFIDENCE
                </div>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>{img.label}</p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--text-muted, #6b7280)" }}>
                  Inference method: On-device AI (placeholder model)
                </p>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.85rem", color: "var(--text-muted, #6b7280)", padding: "0 1rem 2rem" }}>
          Full AI pipeline with camera capture and TFLite inference available in the live screening flow.
        </p>
      </div>
    </main>
  );
}
