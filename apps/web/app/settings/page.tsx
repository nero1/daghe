import Link from "next/link";

export default function SettingsPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Settings</h1>
      <Link
        href="/settings/api-keys"
        style={{
          display: "block",
          padding: "1rem 1.25rem",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          textDecoration: "none",
          color: "inherit",
          background: "#f8fafc",
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 4 }}>API Keys</p>
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Manage your AI provider keys</p>
      </Link>
    </main>
  );
}
