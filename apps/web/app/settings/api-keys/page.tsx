"use client";
import { useEffect, useState } from "react";
import { getSavedLang, strings } from "@/lib/i18n";
import { ensureCsrfToken } from "@/lib/csrf";

type KeyEntry = { provider: string; maskedKey: string; updatedAt: string };
type Provider = "gemini" | "openai" | "deepseek";

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Google Gemini Flash",
  openai: "OpenAI GPT-4o",
  deepseek: "DeepSeek Chat",
};

export default function ApiKeysPage() {
  const t = strings[getSavedLang()];
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [message, setMessage] = useState("");
  const [newProvider, setNewProvider] = useState<Provider>("gemini");
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { void loadKeys(); }, []);

  async function loadKeys() {
    const r = await fetch("/api/keys", { credentials: "include" });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? "Failed to load keys"); return; }
    setKeys(body.data?.keys ?? []);
  }

  async function addKey() {
    if (!newKey) return;
    setLoading(true);
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ provider: newProvider, apiKey: newKey }),
    });
    const body = await r.json();
    setLoading(false);
    if (!r.ok) { setMessage(body?.error?.message ?? "Failed to save key"); return; }
    setMessage("Key saved.");
    setNewKey("");
    void loadKeys();
  }

  async function deleteKey(provider: string) {
    const csrf = await ensureCsrfToken();
    const r = await fetch("/api/keys", {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      credentials: "include",
      body: JSON.stringify({ provider }),
    });
    const body = await r.json();
    if (!r.ok) { setMessage(body?.error?.message ?? "Failed to delete key"); return; }
    setMessage("Key removed.");
    void loadKeys();
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>API Key Management</h1>
      <p style={{ fontSize: "0.875rem", color: "#555", marginBottom: "1.5rem" }}>
        Store your own AI provider keys for on-premises inference billing. Keys are encrypted with AES-256-GCM and never returned in plaintext.
      </p>

      {message && (
        <p style={{ color: message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") ? "#dc2626" : "#059669", marginBottom: "1rem", fontWeight: 600 }}>
          {message}
        </p>
      )}

      <section style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Add / Update Key</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>Provider</label>
            <select value={newProvider} onChange={e => setNewProvider(e.target.value as Provider)} style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: 6 }}>
              {(["gemini", "openai", "deepseek"] as Provider[]).map(p => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>API Key</label>
            <input
              type="password"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="sk-..."
              style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "monospace" }}
            />
          </div>
          <button
            onClick={() => { void addKey(); }}
            disabled={!newKey || loading}
            style={{ padding: "10px 16px", background: newKey ? "#2563eb" : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: newKey ? "pointer" : "not-allowed", fontWeight: 600, minHeight: 44 }}
          >
            {loading ? "Saving…" : "Save Key"}
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Stored Keys</h2>
        {keys.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No keys stored yet.</p>
        ) : (
          keys.map(k => (
            <div key={k.provider} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: "0.5rem" }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: 2 }}>{PROVIDER_LABELS[k.provider as Provider] ?? k.provider}</p>
                <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#555" }}>{k.maskedKey}</p>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Updated {new Date(k.updatedAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => { void deleteKey(k.provider); }}
                style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "1px solid #dc2626", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
