"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSavedLang, strings } from "@/lib/i18n";
import { ensureCsrfToken } from "@/lib/csrf";

type UserRow = { id: string; email: string; name: string; role: string; status: string; clinic_id?: string; created_at: string };
type ClinicRow = { id: string; name: string; region_id?: string; created_at: string };
type RegionRow = { id: string; name: string; country: string; created_at: string };
type Metrics = { totalCases: number; todayCases: number; totalUsers: number; [key: string]: unknown };

type Tab = "users" | "clinics" | "regions" | "metrics" | "modules" | "ai-providers" | "cost" | "health" | "email-settings";

export default function AdminPage() {
  const router = useRouter();
  const lang = getSavedLang();
  const t = strings[lang];

  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("users");
  const [message, setMessage] = useState("");

  // Users tab
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userCursor, setUserCursor] = useState(0);
  const [userNextCursor, setUserNextCursor] = useState<number | null>(null);
  const [userTotal, setUserTotal] = useState(0);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("chw");
  const [newClinicId, setNewClinicId] = useState("");
  const [newRegionId, setNewRegionId] = useState("");

  // Clinics tab
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [clinicName, setClinicName] = useState("");
  const [clinicRegionId, setClinicRegionId] = useState("");

  // Regions tab
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [regionName, setRegionName] = useState("");

  // Metrics tab
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  // Modules tab
  const [modules, setModules] = useState<Array<{ id: string; display_name: string; enabled: boolean; model_version: string }>>([]);
  // AI Providers tab
  const [aiConfig, setAiConfig] = useState<Record<string, boolean>>({});
  // Cost Dashboard tab
  const [costRows, setCostRows] = useState<Array<{ provider: string; total_cost: string; total_calls: number; total_tokens: number }>>([]);
  // System Health tab
  const [healthData, setHealthData] = useState<{ stuckEncounters: number; monthlyCost: string; checkedAt: string } | null>(null);
  // Email Settings tab
  const [emailSettings, setEmailSettings] = useState<{ masterEnabled: boolean; weeklyEnabled: boolean }>({ masterEnabled: true, weeklyEnabled: true });

  useEffect(() => {
    fetch("/api/admin/users?limit=1", { credentials: "include" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          setAccessDenied(true);
        }
        setLoading(false);
      })
      .catch(() => { setAccessDenied(true); setLoading(false); });
  }, []);

  async function loadUsers(cursor = 0) {
    const r = await fetch(`/api/admin/users?cursor=${cursor}&limit=20`, { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    const data = body.data ?? {};
    setUsers(data.users ?? data.rows ?? data ?? []);
    setUserCursor(cursor);
    setUserNextCursor(data.nextCursor ?? null);
    setUserTotal(data.total ?? 0);
    setMessage("");
  }

  async function createUser() {
    if (!newEmail || !newPassword || !newName) return;
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role: newRole, clinic_id: newClinicId || undefined, region_id: newRegionId || undefined }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.adminSaved);
    setNewEmail(""); setNewPassword(""); setNewName(""); setNewClinicId(""); setNewRegionId("");
    loadUsers(0);
  }

  async function deactivateUser(id: string) {
    const csrf = await ensureCsrfToken();
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ status: "inactive" }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.adminSaved);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: "inactive" } : u));
  }

  async function changeRole(id: string, role: string) {
    const csrf = await ensureCsrfToken();
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.adminSaved);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
  }

  async function loadClinics() {
    const r = await fetch("/api/admin/clinics", { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setClinics(body.data?.rows ?? body.data ?? []);
    setMessage("");
  }

  async function createClinic() {
    if (!clinicName) return;
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/admin/clinics", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ name: clinicName, region_id: clinicRegionId || undefined }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.adminSaved);
    setClinicName(""); setClinicRegionId("");
    loadClinics();
  }

  async function loadRegions() {
    const r = await fetch("/api/admin/regions", { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setRegions(body.data?.rows ?? body.data ?? []);
    setMessage("");
  }

  async function createRegion() {
    if (!regionName) return;
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/admin/regions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ name: regionName, country: "Nigeria" }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.adminSaved);
    setRegionName("");
    loadRegions();
  }

  async function loadMetrics() {
    const r = await fetch("/api/metrics", { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMetrics(body.data ?? body);
    setMessage("");
  }

  async function loadModules() {
    const r = await fetch("/api/admin/modules", { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setModules(body.data ?? []);
    setMessage("");
  }

  async function toggleModule(id: string, enabled: boolean) {
    const csrf = await ensureCsrfToken();
    const r = await fetch(`/api/admin/modules/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ enabled }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.adminSaved);
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
  }

  async function loadAiConfig() {
    const r = await fetch("/api/admin/ai-config", { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setAiConfig(body.data ?? {});
    setMessage("");
  }

  async function setAiProvider(provider: string, enabled: boolean) {
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/admin/ai-config", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ provider, enabled }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setAiConfig(prev => ({ ...prev, [`${provider}_enabled`]: enabled }));
    setMessage(t.adminSaved);
  }

  async function loadCostDashboard() {
    const r = await fetch("/api/admin/cost-summary", { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setCostRows(body.data ?? []);
    setMessage("");
  }

  async function loadHealth() {
    const r = await fetch("/api/cron/sync-health", {
      credentials: "include",
      headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "dev-cron-secret"}` }
    });
    const body = await r.json();
    const costR = await fetch("/api/admin/cost-summary", { credentials: "include" });
    const costBody = await costR.json();
    const totalCost = (costBody.data ?? []).reduce((acc: number, row: { total_cost: string }) => acc + parseFloat(row.total_cost ?? "0"), 0);
    setHealthData({ stuckEncounters: body.data?.stuckPendingCount ?? 0, monthlyCost: totalCost.toFixed(6), checkedAt: new Date().toISOString() });
    setMessage("");
  }

  async function saveEmailSettings() {
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/admin/ai-config", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ provider: "email_master", enabled: emailSettings.masterEnabled }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? t.adminError); return; }
    setMessage(t.adminSaved);
  }

  if (loading) return <main className="container"><p>Loading…</p></main>;

  if (accessDenied) {
    return (
      <main className="container">
        <h1>{t.adminTitle}</h1>
        <section className="card card--danger">
          <p>Access denied. Admin login required.</p>
          <button onClick={() => router.push("/")} style={{ marginTop: "1rem" }}>Go to Login</button>
        </section>
      </main>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem",
    border: "none",
    borderBottom: active ? "2px solid #0ea5e9" : "2px solid transparent",
    background: "none",
    fontWeight: active ? 700 : 400,
    color: active ? "#0ea5e9" : "#555",
    cursor: "pointer",
  });

  return (
    <main className="container">
      <h1>{t.adminTitle}</h1>

      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid #ddd", marginBottom: "1.5rem" }}>
        <button style={tabStyle(tab === "users")} onClick={() => { setTab("users"); loadUsers(0); }}>{t.adminUsers}</button>
        <button style={tabStyle(tab === "clinics")} onClick={() => { setTab("clinics"); loadClinics(); }}>{t.adminClinics}</button>
        <button style={tabStyle(tab === "regions")} onClick={() => { setTab("regions"); loadRegions(); }}>{t.adminRegions}</button>
        <button style={tabStyle(tab === "metrics")} onClick={() => { setTab("metrics"); loadMetrics(); }}>{t.metricsTitle}</button>
        <button style={tabStyle(tab === "modules")} onClick={() => { setTab("modules"); loadModules(); }}>Modules</button>
        <button style={tabStyle(tab === "ai-providers")} onClick={() => { setTab("ai-providers"); loadAiConfig(); }}>AI Providers</button>
        <button style={tabStyle(tab === "cost")} onClick={() => { setTab("cost"); loadCostDashboard(); }}>Cost Dashboard</button>
        <button style={tabStyle(tab === "health")} onClick={() => { setTab("health"); loadHealth(); }}>System Health</button>
        <button style={tabStyle(tab === "email-settings")} onClick={() => { setTab("email-settings"); }}>Email Settings</button>
      </div>

      {message && <p style={{ color: message === t.adminSaved ? "#2e7d32" : "red" }}>{message}</p>}

      {tab === "users" && (
        <>
          <section className="card">
            <h2>{t.adminCreateUser}</h2>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label>{t.adminUserEmail}</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div>
                <label>{t.adminUserPassword}</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label>{t.adminUserName}</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label>{t.adminUserRole}</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="chw">CHW</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label>{t.adminUserClinic}</label>
                <input type="text" value={newClinicId} onChange={(e) => setNewClinicId(e.target.value)} placeholder="UUID" />
              </div>
              <div>
                <label>{t.adminUserRegion}</label>
                <input type="text" value={newRegionId} onChange={(e) => setNewRegionId(e.target.value)} placeholder="UUID" />
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: "1rem" }} onClick={createUser}>{t.adminCreateUser}</button>
          </section>

          {users.length > 0 && (
            <section style={{ marginTop: "1rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>{t.adminUserEmail}</th>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>{t.adminUserName}</th>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>{t.adminUserRole}</th>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>{t.adminUserClinic}</th>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>Created</th>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid #ddd" }}>
                      <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{u.email}</td>
                      <td style={{ padding: "0.4rem" }}>{u.name}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} style={{ fontSize: "0.8rem" }}>
                          <option value="chw">chw</option>
                          <option value="supervisor">supervisor</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{u.status}</td>
                      <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.7rem" }}>{u.clinic_id ?? "—"}</td>
                      <td style={{ padding: "0.4rem" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: "0.4rem" }}>
                        {u.status !== "inactive" && (
                          <button onClick={() => deactivateUser(u.id)} style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "#b71c1c", border: "1px solid #b71c1c", background: "none", borderRadius: "0.25rem", cursor: "pointer" }}>
                            {t.adminDeactivate}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="actions" style={{ marginTop: "0.75rem", display: "flex", gap: 8, alignItems: "center" }}>
                <button disabled={userCursor === 0} onClick={() => loadUsers(Math.max(0, userCursor - 20))}>Prev</button>
                <span style={{ fontSize: "0.85rem" }}>{userTotal > 0 ? `${userCursor + 1}–${Math.min(userCursor + 20, userTotal)} of ${userTotal}` : "0 users"}</span>
                <button disabled={userNextCursor === null} onClick={() => { if (userNextCursor !== null) loadUsers(userNextCursor); }}>Next</button>
              </div>
            </section>
          )}
          {users.length === 0 && <p style={{ color: "#555" }}>No users loaded. <button onClick={() => loadUsers(0)}>Load users</button></p>}
        </>
      )}

      {tab === "clinics" && (
        <>
          <section className="card">
            <h2>{t.adminClinics}</h2>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label>Name</label>
                <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
              </div>
              <div>
                <label>{t.adminUserRegion}</label>
                <input type="text" value={clinicRegionId} onChange={(e) => setClinicRegionId(e.target.value)} placeholder="UUID" />
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: "1rem" }} onClick={createClinic}>Create Clinic</button>
          </section>
          {clinics.map((c) => (
            <article key={c.id} className="card" style={{ fontSize: "0.85rem" }}>
              <p><strong>{c.name}</strong></p>
              <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#555" }}>ID: {c.id}</p>
              {c.region_id && <p style={{ color: "#555" }}>Region: {c.region_id}</p>}
              <p style={{ color: "#888" }}>{new Date(c.created_at).toLocaleDateString()}</p>
            </article>
          ))}
        </>
      )}

      {tab === "regions" && (
        <>
          <section className="card">
            <h2>{t.adminRegions}</h2>
            <div>
              <label>Name</label>
              <input type="text" value={regionName} onChange={(e) => setRegionName(e.target.value)} />
            </div>
            <button className="btn-primary" style={{ marginTop: "1rem" }} onClick={createRegion}>Create Region</button>
          </section>
          {regions.map((r) => (
            <article key={r.id} className="card" style={{ fontSize: "0.85rem" }}>
              <p><strong>{r.name}</strong> · {r.country}</p>
              <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#555" }}>ID: {r.id}</p>
              <p style={{ color: "#888" }}>{new Date(r.created_at).toLocaleDateString()}</p>
            </article>
          ))}
        </>
      )}

      {tab === "metrics" && (
        <>
          {metrics ? (
            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
              <section className="card">
                <h2>{t.metricsTotal}</h2>
                <p style={{ fontSize: "2rem", fontWeight: 700, color: "#0ea5e9" }}>{metrics.totalCases ?? "—"}</p>
              </section>
              <section className="card">
                <h2>{t.metricsToday}</h2>
                <p style={{ fontSize: "2rem", fontWeight: 700, color: "#0ea5e9" }}>{metrics.todayCases ?? "—"}</p>
              </section>
              {Object.entries(metrics)
                .filter(([k]) => k !== "totalCases" && k !== "todayCases")
                .map(([k, v]) => (
                  <section key={k} className="card">
                    <h2>{k}</h2>
                    <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{String(v)}</p>
                  </section>
                ))}
            </div>
          ) : (
            <button onClick={loadMetrics}>Load Metrics</button>
          )}
        </>
      )}

      {tab === "modules" && (
        <>
          {modules.length === 0 && <button onClick={loadModules}>Load Modules</button>}
          {modules.map(m => (
            <section key={m.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem" }}>
              <div>
                <strong>{m.display_name}</strong>
                <p style={{ fontSize: "0.8rem", color: "#555", margin: "0.25rem 0 0" }}>Model v{m.model_version} · ID: {m.id}</p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={e => toggleModule(m.id, e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                {m.enabled ? "Enabled" : "Disabled"}
              </label>
            </section>
          ))}
        </>
      )}

      {tab === "ai-providers" && (
        <>
          {Object.keys(aiConfig).length === 0 && <button onClick={loadAiConfig}>Load AI Config</button>}
          {["gemini", "openai", "deepseek"].map(provider => (
            <section key={provider} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", marginBottom: "0.5rem" }}>
              <div>
                <strong style={{ textTransform: "capitalize" }}>{provider === "openai" ? "OpenAI (GPT-4o)" : provider === "gemini" ? "Google Gemini Flash" : "DeepSeek"}</strong>
                <p style={{ fontSize: "0.8rem", color: "#555", margin: "0.25rem 0 0" }}>
                  {provider === "gemini" ? "Primary on-device fallback" : provider === "openai" ? "Secondary cloud fallback" : "Tertiary cloud fallback"}
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={aiConfig[`${provider}_enabled`] ?? true}
                  onChange={e => setAiProvider(provider, e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                {aiConfig[`${provider}_enabled`] !== false ? "Enabled" : "Disabled"}
              </label>
            </section>
          ))}
        </>
      )}

      {tab === "cost" && (
        <>
          {costRows.length === 0 && <button onClick={loadCostDashboard}>Load Cost Summary</button>}
          {costRows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Provider</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Total Cost (USD)</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>API Calls</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Total Tokens</th>
                </tr>
              </thead>
              <tbody>
                {costRows.map(row => (
                  <tr key={row.provider} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.5rem", textTransform: "capitalize" }}>{row.provider}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "monospace" }}>${parseFloat(row.total_cost).toFixed(6)}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{row.total_calls.toLocaleString()}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{row.total_tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "health" && (
        <>
          {!healthData && <button onClick={loadHealth}>Refresh Health</button>}
          {healthData && (
            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
              <section className="card">
                <h2>Stuck Encounters</h2>
                <p style={{ fontSize: "2rem", fontWeight: 700, color: healthData.stuckEncounters > 0 ? "#dc2626" : "#059669" }}>{healthData.stuckEncounters}</p>
                <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>Pending &gt;24h</p>
              </section>
              <section className="card">
                <h2>Monthly AI Cost</h2>
                <p style={{ fontSize: "2rem", fontWeight: 700, color: "#0ea5e9" }}>${healthData.monthlyCost}</p>
                <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>Current month (USD)</p>
              </section>
              <section className="card" style={{ gridColumn: "span 2" }}>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Last refreshed: {new Date(healthData.checkedAt).toLocaleTimeString()}</p>
                <button onClick={loadHealth} style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>Refresh</button>
              </section>
            </div>
          )}
        </>
      )}

      {tab === "email-settings" && (
        <section className="card">
          <h2>Email Notification Settings</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input type="checkbox" checked={emailSettings.masterEnabled} onChange={e => setEmailSettings(prev => ({ ...prev, masterEnabled: e.target.checked }))} style={{ width: 18, height: 18 }} />
              <span><strong>Enable all email notifications</strong><br /><span style={{ fontSize: "0.8rem", color: "#555" }}>Master toggle — disables all emails when off</span></span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input type="checkbox" checked={emailSettings.weeklyEnabled} onChange={e => setEmailSettings(prev => ({ ...prev, weeklyEnabled: e.target.checked }))} style={{ width: 18, height: 18 }} />
              <span><strong>Weekly supervisor summary email</strong><br /><span style={{ fontSize: "0.8rem", color: "#555" }}>Sent every Monday with encounter counts and cost summary</span></span>
            </label>
          </div>
          <button className="btn-primary" onClick={() => { void saveEmailSettings(); }}>Save Email Settings</button>
        </section>
      )}
    </main>
  );
}
