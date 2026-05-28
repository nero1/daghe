"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { LocalEncounter } from "@daghe/shared";
import { getAllEncounters } from "@/lib/encounters";
import { strings, getSavedLang, type Lang } from "@/lib/i18n";

const PAGE_SIZE = 20;

const BAND_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: "#d1fae5", text: "#065f46" },
  MODERATE: { bg: "#fef3c7", text: "#92400e" },
  LOW: { bg: "#fee2e2", text: "#991b1b" },
  REFERENCE_ONLY: { bg: "#f3f4f6", text: "#374151" },
};

const CLASS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  POSITIVE: { bg: "#fee2e2", text: "#991b1b", icon: "⚠" },
  NEGATIVE: { bg: "#d1fae5", text: "#065f46", icon: "✓" },
  REFER: { bg: "#fef3c7", text: "#92400e", icon: "→" },
};

export default function EncountersPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = strings[lang] as typeof strings.en;
  const router = useRouter();

  const [allEncounters, setAllEncounters] = useState<LocalEncounter[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLang(getSavedLang());
  }, []);

  const loadEncounters = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllEncounters();
      setAllEncounters(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEncounters();
  }, [loadEncounters]);

  const page = allEncounters.slice(cursor, cursor + PAGE_SIZE);
  const hasNext = cursor + PAGE_SIZE < allEncounters.length;
  const hasPrev = cursor > 0;

  function formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  const methodLabels: Record<string, string> = {
    tflite: "On-device AI",
    gemini: "Online AI (Gemini)",
    gpt4o: "Online AI (GPT-4o)",
    "rule-based": "Offline guidance",
    reference: "Reference only",
  };

  return (
    <main style={{ padding: "1rem", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <button
          onClick={() => router.push("/screening")}
          aria-label="New Screening"
          style={{
            padding: "10px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.875rem",
            minHeight: 44,
          }}
        >
          + {t.newScreening ?? "New Screening"}
        </button>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          {t.encounters ?? "Case Log"}
        </h1>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem" }}>Loading…</p>
      ) : allEncounters.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "1rem", marginBottom: 16 }}>No encounters recorded yet.</p>
          <button
            onClick={() => router.push("/screening")}
            style={{
              padding: "12px 24px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Start First Screening
          </button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 12 }}>
            {allEncounters.length} encounter{allEncounters.length !== 1 ? "s" : ""} stored on this device
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {page.map(enc => {
              const cls = CLASS_COLORS[enc.result.classification] ?? CLASS_COLORS.REFER;
              const band = BAND_COLORS[enc.result.confidenceBand] ?? BAND_COLORS.MODERATE;
              return (
                <div
                  key={enc.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      background: cls.bg,
                      color: cls.text,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      <span aria-hidden="true" style={{ marginInlineEnd: 6 }}>{cls.icon}</span>
                      {enc.result.classification}
                    </span>
                    <span
                      style={{
                        background: band.bg,
                        color: band.text,
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {enc.result.confidenceBand.replace("_", " ")}
                    </span>
                  </div>

                  <div style={{ padding: "10px 14px", fontSize: "0.85rem", color: "#374151" }}>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 4 }}>
                      <span>Age: {enc.patientAgeBand}</span>
                      <span>Context: {enc.screeningContext}</span>
                      <span>Method: {methodLabels[enc.result.inferenceMethod] ?? enc.result.inferenceMethod}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: "#6b7280", fontSize: "0.78rem" }}>
                        {formatDate(enc.utcTime)}
                      </span>
                      {enc.syncStatus === "synced" ? (
                        <span style={{ color: "#059669", fontSize: "0.75rem", fontWeight: 600 }}>✓ Synced</span>
                      ) : enc.syncStatus === "pending" ? (
                        <span style={{ color: "#d97706", fontSize: "0.75rem" }}>⏳ Pending sync</span>
                      ) : (
                        <span style={{ color: "#dc2626", fontSize: "0.75rem" }}>✗ Sync failed</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cursor-based pagination — index position in sorted array */}
          {(hasPrev || hasNext) && (
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "center" }}>
              <button
                onClick={() => setCursor(c => Math.max(0, c - PAGE_SIZE))}
                disabled={!hasPrev}
                aria-label="Previous page"
                style={{
                  padding: "10px 20px",
                  background: hasPrev ? "#f3f4f6" : "#e5e7eb",
                  color: hasPrev ? "#374151" : "#9ca3af",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  cursor: hasPrev ? "pointer" : "not-allowed",
                  minHeight: 44,
                }}
              >
                ← Previous
              </button>
              <span style={{ alignSelf: "center", fontSize: "0.8rem", color: "#6b7280" }}>
                {cursor + 1}–{Math.min(cursor + PAGE_SIZE, allEncounters.length)} of {allEncounters.length}
              </span>
              <button
                onClick={() => setCursor(c => c + PAGE_SIZE)}
                disabled={!hasNext}
                aria-label="Next page"
                style={{
                  padding: "10px 20px",
                  background: hasNext ? "#f3f4f6" : "#e5e7eb",
                  color: hasNext ? "#374151" : "#9ca3af",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  cursor: hasNext ? "pointer" : "not-allowed",
                  minHeight: 44,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
