"use client";

import { useEffect, useState } from "react";
import { readCases, type LocalCase } from "@/lib/cases";
import { applySyncResults } from "@/lib/sync";
import { getSavedLang, strings, triageOutcomes } from "@/lib/i18n";
import { ensureCsrfToken } from "@/lib/csrf";

type SyncResult = { id: string; status: "synced" | "duplicate" | "failed"; message?: string };

export default function CasesPage() {
  const [cases, setCases] = useState<LocalCase[]>([]);
  const [lastSyncMessage, setLastSyncMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const unsynced = cases.filter((c) => c.syncStatus !== "synced");
  const lang = getSavedLang();
  const t = strings[lang];

  useEffect(() => {
    readCases().then(setCases);
  }, []);

  function toggleDetail(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function syncUnsynced() {
    if (!unsynced.length) return;
    setLastSyncMessage("");

    const csrf = await ensureCsrfToken();
    let response = await fetch("/api/cases/sync", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ cases: unsynced })
    });

    // Attempt one silent refresh before showing a login-required error.
    if (response.status === 401) {
      const refreshResponse = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", headers: { "x-csrf-token": csrf } });
      if (refreshResponse.ok) {
        response = await fetch("/api/cases/sync", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          credentials: "include",
          body: JSON.stringify({ cases: unsynced })
        });
      }
    }

    if (!response.ok) {
      setLastSyncMessage(response.status === 401 ? "Sync blocked: login required." : "Sync failed before server processing.");
      return;
    }

    const body = (await response.json()) as { data: { results: SyncResult[] } };
    await applySyncResults(body.data.results, unsynced);

    const failed = body.data.results.filter((r) => r.status === "failed").length;
    setLastSyncMessage(failed ? `Synced with ${failed} failures. Retry later.` : "All unsynced cases uploaded.");
    setCases(await readCases());
  }

  return (
    <main className="container">
      <h1>{t.casesTitle}</h1>
      <p>{t.unsynced}: {unsynced.length}</p>
      <button onClick={syncUnsynced}>{t.sync}</button>
      {lastSyncMessage && <p>{lastSyncMessage}</p>}
      {cases.map((item) => (
        <article className="card" key={item.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p><strong>{item.riskLevel.toUpperCase()}</strong> · {item.symptomCluster.replace(/_/g, " ")}</p>
              <p style={{ fontSize: "0.85rem", color: "#555" }}>
                {t.ageRangeShort}: {item.patientAgeRange}
                {item.patientSex ? ` · ${t.sexShort}: ${item.patientSex}` : ""}
              </p>
              <p>{new Date(item.createdAt).toLocaleString()}</p>
              <p>{t.status}: {item.syncStatus}</p>
              {item.nextRetryAt ? <p>{t.nextRetry}: {new Date(item.nextRetryAt).toLocaleString()}</p> : null}
            </div>
            <button style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }} onClick={() => toggleDetail(item.id)}>
              {expanded.has(item.id) ? t.hideDetail : t.viewDetail}
            </button>
          </div>

          {expanded.has(item.id) && (
            <div style={{ marginTop: "0.75rem", borderTop: "1px solid #ddd", paddingTop: "0.75rem", fontSize: "0.85rem" }}>
              {(() => {
                const localized = item.outcomeKey ? triageOutcomes[lang][item.outcomeKey] : undefined;
                const localCondition = localized?.likelyCondition ?? item.likelyCondition;
                const localRecommendation = localized?.recommendation ?? item.recommendation;
                const localCareAdvice = localized?.careAdvice ?? item.careAdvice;
                const localRedFlags = localized?.redFlags ?? item.redFlags;
                return (<>
                  <p><strong>{t.likelyCondition}:</strong> {localCondition}</p>
                  <p><strong>{t.recommendation}:</strong> {localRecommendation}</p>
                  <p><strong>{t.careAdvice}:</strong> {localCareAdvice}</p>
                  {localRedFlags.length > 0 && (
                    <div>
                      <strong>{t.redFlags}:</strong>
                      <ul style={{ margin: "0.25rem 0 0 1rem" }}>
                        {localRedFlags.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                </>);
              })()}
              {(item.locationLat !== undefined && item.locationLng !== undefined) && (
                <p style={{ color: "#555" }}>
                  Location: {item.locationLat.toFixed(5)}, {item.locationLng.toFixed(5)}
                  {item.locationAccuracy !== undefined ? ` (±${Math.round(item.locationAccuracy)}m)` : ""}
                </p>
              )}
            </div>
          )}
        </article>
      ))}
    </main>
  );
}
