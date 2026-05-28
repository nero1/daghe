"use client";

import { useState } from "react";
import { getSavedLang, strings } from "@/lib/i18n";
import { ensureCsrfToken } from "@/lib/csrf";

type Summary = { totalCases: number; urgentCases: number; emergencyCases: number; appliedRiskLevel: string };
type CaseRow = {
  id: string; created_at: string; risk_level: string; recommended_action: string;
  chw_user_id: string; patient_age_range?: string;
  location_lat?: number; location_lng?: number;
  flagged?: boolean; flag_reason?: string;
};
type ChwStatRow = { chw_user_id: string; total_cases: number; urgent_cases: number; emergency_cases: number; last_case_at: string };
type AuditRow = { id: string; actor_user_id: string; actor_role: string; action: string; payload: Record<string, unknown>; created_at: string };
type ClusterAlert = { illness_type: string; count: number; region?: string; date_from?: string; date_to?: string };

const CLUSTER_OPTIONS = ["", "fever", "breathing", "vomiting_diarrhea", "confusion_collapse", "skin_rash", "other"];

const riskColors: Record<string, string> = {
  monitor: "#2e7d32",
  treat_local: "#1565c0",
  refer: "#7b1fa2",
  urgent: "#e65100",
  emergency: "#b71c1c",
};

// Nigeria approximate bounds: lat 4-14, lng 3-15
const LAT_MIN = 4, LAT_MAX = 14, LNG_MIN = 3, LNG_MAX = 15;
const MAP_W = 400, MAP_H = 300;

function normLat(lat: number) { return MAP_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_H; }
function normLng(lng: number) { return ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W; }

export default function DashboardPage() {
  const lang = getSavedLang();
  const t = strings[lang];

  // Filters
  const [riskLevel, setRiskLevel] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [illnessType, setIllnessType] = useState("");
  const [chwUserId, setChwUserId] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  // Data sections
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [chwStats, setChwStats] = useState<ChwStatRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");

  // Cluster alerts
  const [clusters, setClusters] = useState<ClusterAlert[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(false);

  // Flag state per row: id -> { open, reason }
  const [flagForms, setFlagForms] = useState<Record<string, { open: boolean; reason: string }>>({});

  function buildFilterParams(extra?: Record<string, string>) {
    const p = new URLSearchParams();
    if (riskLevel && riskLevel !== "all") p.set("riskLevel", riskLevel);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (illnessType) p.set("illnessType", illnessType);
    if (chwUserId.trim()) p.set("chwUserId", chwUserId.trim());
    if (locationFilter.trim()) p.set("location", locationFilter.trim());
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  }

  async function loadSummary() {
    const response = await fetch(`/api/dashboard/summary?${buildFilterParams()}`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.error?.message ?? "Failed to load dashboard.");
    setSummary(body.data);
    setMessage("");
  }

  async function loadCases(nextPage = 1) {
    const response = await fetch(`/api/dashboard/cases?${buildFilterParams({ page: String(nextPage), limit: "20" })}`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.error?.message ?? "Failed to load case rows.");
    setRows(body.data.rows);
    setPage(body.data.page);
  }

  async function loadChwStats() {
    const response = await fetch("/api/dashboard/chw-stats", { credentials: "include" });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.error?.message ?? "Failed to load CHW stats.");
    setChwStats(body.data.rows ?? []);
  }

  async function loadAuditLogs(nextPage = 1) {
    const response = await fetch(`/api/audit?page=${nextPage}&limit=20`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.error?.message ?? "Failed to load audit logs.");
    setAuditRows(body.data.rows ?? []);
    setAuditPage(body.data.page ?? 1);
    setAuditTotal(body.data.total ?? 0);
  }

  async function exportCsv() {
    const response = await fetch(`/api/dashboard/export?${buildFilterParams()}`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) return setMessage(body?.error?.message ?? "Failed to export.");
    const blob = new Blob([body.data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = body.data.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadClusters() {
    setLoadingClusters(true);
    const response = await fetch("/api/dashboard/clusters", { credentials: "include" });
    const body = await response.json();
    setLoadingClusters(false);
    if (!response.ok) return setMessage(body?.error?.message ?? "Failed to load clusters.");
    setClusters(body.data?.rows ?? body.data ?? []);
    setMessage("");
  }

  function openFlagForm(id: string) {
    setFlagForms((prev) => ({ ...prev, [id]: { open: true, reason: prev[id]?.reason ?? "" } }));
  }

  function closeFlagForm(id: string) {
    setFlagForms((prev) => ({ ...prev, [id]: { ...prev[id], open: false } }));
  }

  async function submitFlag(row: CaseRow) {
    const isCurrentlyFlagged = row.flagged;
    const formState = flagForms[row.id];
    const csrf = await ensureCsrfToken();
    const r = await fetch(`/api/cases/${row.id}/flag`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ flagged: !isCurrentlyFlagged, reason: formState?.reason || undefined }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.flagSaved);
    setRows((prev) => prev.map((c) => c.id === row.id ? { ...c, flagged: !isCurrentlyFlagged, flag_reason: formState?.reason || undefined } : c));
    closeFlagForm(row.id);
  }

  const casesWithLocation = rows.filter((r) => r.location_lat !== undefined && r.location_lng !== undefined);

  return (
    <main className="container">
      <h1>{t.dashTitle}</h1>

      {/* ── Filters ── */}
      <section className="card">
        <h2>Filters</h2>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label>{t.riskFilter}</label>
            <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
              <option value="all">All</option>
              <option value="monitor">Monitor</option>
              <option value="treat_local">Treat locally</option>
              <option value="refer">Refer</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label>{t.illnessFilter}</label>
            <select value={illnessType} onChange={(e) => setIllnessType(e.target.value)}>
              {CLUSTER_OPTIONS.map((c) => (
                <option key={c} value={c}>{c === "" ? "All" : c.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label>{t.dateFrom}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label>{t.dateTo}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <label>{t.chwFilter}</label>
            <input type="text" value={chwUserId} onChange={(e) => setChwUserId(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <label>{t.locationFilter}</label>
            <input type="text" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Location / Region (optional)" />
          </div>
        </div>
      </section>

      {/* ── Actions ── */}
      <div className="actions" style={{ flexWrap: "wrap" }}>
        <button onClick={loadSummary}>{t.loadSummary}</button>
        <button onClick={() => loadCases(1)}>Load Cases</button>
        <button onClick={exportCsv}>Export CSV</button>
        <button onClick={loadChwStats}>{t.loadChwStats}</button>
        <button onClick={() => loadAuditLogs(1)}>{t.loadAuditLogs}</button>
        <button onClick={loadClusters} disabled={loadingClusters}>{loadingClusters ? "…" : t.loadClusters}</button>
      </div>

      {message && <p style={{ color: message === t.flagSaved || message === t.adminSaved ? "#2e7d32" : "red" }}>{message}</p>}

      {/* ── Summary ── */}
      {summary && (
        <section className="card">
          <h2>{t.loadSummary}</h2>
          <p>Total cases: <strong>{summary.totalCases}</strong></p>
          <p>Urgent cases: <strong>{summary.urgentCases}</strong></p>
          <p>Emergency cases: <strong>{summary.emergencyCases}</strong></p>
          <p>Applied filter: {summary.appliedRiskLevel}</p>
        </section>
      )}

      {/* ── Cluster Alerts ── */}
      {clusters.length > 0 && (
        <section>
          <h2>{t.clustersTitle}</h2>
          {clusters.map((cl, i) => (
            <article key={i} className="card" style={{ fontSize: "0.85rem" }}>
              <p><strong>{cl.illness_type.replace(/_/g, " ")}</strong> · {cl.count} cases</p>
              {cl.region && <p style={{ color: "#555" }}>Region: {cl.region}</p>}
              {(cl.date_from || cl.date_to) && (
                <p style={{ color: "#888", fontSize: "0.8rem" }}>
                  {cl.date_from ? new Date(cl.date_from).toLocaleDateString() : "?"} – {cl.date_to ? new Date(cl.date_to).toLocaleDateString() : "?"}
                </p>
              )}
            </article>
          ))}
        </section>
      )}

      {/* ── Case Rows ── */}
      {rows.length > 0 && (
        <section>
          <h2>Cases</h2>
          {rows.map((row) => {
            const ff = flagForms[row.id];
            return (
              <article key={row.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p>
                      <strong style={{ color: riskColors[row.risk_level] ?? "#555" }}>{row.risk_level.toUpperCase()}</strong>
                      {" · "}{new Date(row.created_at).toLocaleString()}
                      {row.flagged && (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", background: "#e65100", color: "white", borderRadius: "1rem", padding: "0.1rem 0.5rem" }}>
                          {t.flagged}
                        </span>
                      )}
                    </p>
                    {row.patient_age_range && <p style={{ fontSize: "0.85rem", color: "#555" }}>{t.ageRangeShort}: {row.patient_age_range}</p>}
                    <p style={{ fontSize: "0.85rem" }}>{row.recommended_action}</p>
                  </div>
                  <button
                    onClick={() => ff?.open ? closeFlagForm(row.id) : openFlagForm(row.id)}
                    style={{ fontSize: "0.78rem", padding: "0.2rem 0.5rem", whiteSpace: "nowrap" }}
                  >
                    {row.flagged ? t.unflagCase : t.flagCase}
                  </button>
                </div>
                {ff?.open && (
                  <div style={{ marginTop: "0.75rem", borderTop: "1px solid #ddd", paddingTop: "0.75rem" }}>
                    <label style={{ fontSize: "0.85rem" }}>{t.flagReason}</label>
                    <input
                      type="text"
                      value={ff.reason}
                      onChange={(e) => setFlagForms((prev) => ({ ...prev, [row.id]: { ...prev[row.id], reason: e.target.value } }))}
                      style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}
                    />
                    <div className="actions">
                      <button onClick={() => closeFlagForm(row.id)}>Cancel</button>
                      <button className="btn-primary" onClick={() => submitFlag(row)}>
                        {row.flagged ? t.unflagCase : t.flagCase}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          <div className="actions">
            <button onClick={() => loadCases(Math.max(1, page - 1))}>Prev</button>
            <span>Page {page}</span>
            <button onClick={() => loadCases(page + 1)}>Next</button>
          </div>
        </section>
      )}

      {/* ── Case Map ── */}
      {rows.length > 0 && (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>{t.mapTitle}</h2>
          {casesWithLocation.length === 0 ? (
            <p style={{ color: "#555" }}>{t.noLocation}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <svg
                width={MAP_W}
                height={MAP_H}
                style={{ border: "1px solid #ddd", borderRadius: "0.5rem", background: "#f0f9ff", display: "block" }}
                viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              >
                {/* Grid lines */}
                {[4, 6, 8, 10, 12, 14].map((lat) => (
                  <line key={`lat-${lat}`} x1={0} x2={MAP_W} y1={normLat(lat)} y2={normLat(lat)} stroke="#cce0f5" strokeWidth={0.5} />
                ))}
                {[3, 5, 7, 9, 11, 13, 15].map((lng) => (
                  <line key={`lng-${lng}`} x1={normLng(lng)} x2={normLng(lng)} y1={0} y2={MAP_H} stroke="#cce0f5" strokeWidth={0.5} />
                ))}
                {casesWithLocation.map((row) => {
                  const cx = normLng(row.location_lng!);
                  const cy = normLat(row.location_lat!);
                  const color = riskColors[row.risk_level] ?? "#555";
                  return (
                    <g key={row.id}>
                      <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.7} stroke="white" strokeWidth={1.5} />
                      <title>{row.risk_level.toUpperCase()} · {new Date(row.created_at).toLocaleDateString()}</title>
                    </g>
                  );
                })}
              </svg>
              <p style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.5rem" }}>
                {casesWithLocation.length} case{casesWithLocation.length !== 1 ? "s" : ""} with location data shown
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── CHW Statistics ── */}
      {chwStats.length > 0 && (
        <section>
          <h2>{t.chwStatsTitle}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.4rem" }}>CHW ID</th>
                <th style={{ textAlign: "right", padding: "0.4rem" }}>Total</th>
                <th style={{ textAlign: "right", padding: "0.4rem" }}>Urgent</th>
                <th style={{ textAlign: "right", padding: "0.4rem" }}>Emergency</th>
                <th style={{ textAlign: "left", padding: "0.4rem" }}>Last Case</th>
              </tr>
            </thead>
            <tbody>
              {chwStats.map((row) => (
                <tr key={row.chw_user_id} style={{ borderTop: "1px solid #ddd" }}>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{row.chw_user_id}</td>
                  <td style={{ textAlign: "right", padding: "0.4rem" }}>{row.total_cases}</td>
                  <td style={{ textAlign: "right", padding: "0.4rem" }}>{row.urgent_cases}</td>
                  <td style={{ textAlign: "right", padding: "0.4rem" }}>{row.emergency_cases}</td>
                  <td style={{ padding: "0.4rem" }}>{row.last_case_at ? new Date(row.last_case_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Audit Logs ── */}
      {auditRows.length > 0 && (
        <section>
          <h2>{t.auditTitle}</h2>
          <p style={{ fontSize: "0.8rem", color: "#555" }}>Total: {auditTotal}</p>
          {auditRows.map((row) => (
            <article key={row.id} className="card" style={{ fontSize: "0.85rem" }}>
              <p><strong>{row.action}</strong> · {row.actor_role} · {new Date(row.created_at).toLocaleString()}</p>
              <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#444" }}>
                Actor: {row.actor_user_id}
              </p>
              {Object.keys(row.payload ?? {}).length > 0 && (
                <p style={{ color: "#555" }}>{JSON.stringify(row.payload)}</p>
              )}
            </article>
          ))}
          <div className="actions">
            <button onClick={() => loadAuditLogs(Math.max(1, auditPage - 1))}>Prev</button>
            <span>Page {auditPage}</span>
            <button onClick={() => loadAuditLogs(auditPage + 1)}>Next</button>
          </div>
        </section>
      )}
    </main>
  );
}
