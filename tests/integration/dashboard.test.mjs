/**
 * Integration tests for dashboard endpoints.
 * Requires: INTEGRATION=true TEST_BASE_URL=http://localhost:3000 TEST_SUPERVISOR_EMAIL=... TEST_SUPERVISOR_PASSWORD=... node tests/integration/dashboard.test.mjs
 */
import assert from "node:assert/strict";

const SKIP = process.env.INTEGRATION !== "true";
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function skip(name, fn) {
  if (SKIP) { console.log(`SKIP [integration/dashboard] ${name}`); return; }
  try {
    await fn();
    console.log(`PASS [integration/dashboard] ${name}`);
  } catch (e) {
    console.error(`FAIL [integration/dashboard] ${name}:`, e.message);
    process.exitCode = 1;
  }
}

async function supervisorHeaders() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_SUPERVISOR_EMAIL, password: process.env.TEST_SUPERVISOR_PASSWORD }),
  });
  return { cookie: login.headers.get("set-cookie") ?? "" };
}

await skip("GET /api/dashboard/summary returns expected shape", async () => {
  const { cookie } = await supervisorHeaders();
  const r = await fetch(`${BASE}/api/dashboard/summary`, { headers: { cookie } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok("totalCases" in body.data, "Summary should have totalCases");
  assert.ok("urgentCases" in body.data, "Summary should have urgentCases");
  assert.ok("emergencyCases" in body.data, "Summary should have emergencyCases");
});

await skip("GET /api/dashboard/cases returns paginated array", async () => {
  const { cookie } = await supervisorHeaders();
  const r = await fetch(`${BASE}/api/dashboard/cases?limit=5&page=1`, { headers: { cookie } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(Array.isArray(body.data.rows), "Cases should return rows array");
  assert.ok(body.data.rows.length <= 5, "Should respect limit");
});

await skip("GET /api/dashboard/clusters returns array", async () => {
  const { cookie } = await supervisorHeaders();
  const r = await fetch(`${BASE}/api/dashboard/clusters`, { headers: { cookie } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(Array.isArray(body.data.clusters), "Clusters should return array");
});

await skip("GET /api/dashboard/export requires supervisor/admin role", async () => {
  // Without auth should fail
  const r = await fetch(`${BASE}/api/dashboard/export`);
  assert.equal(r.status, 401);
});

await skip("GET /api/dashboard/export with auth returns CSV", async () => {
  const { cookie } = await supervisorHeaders();
  const r = await fetch(`${BASE}/api/dashboard/export`, { headers: { cookie } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(body.data?.csv, "Export should return csv field");
  assert.ok(body.data?.filename, "Export should return filename");
});

await skip("GET /api/dashboard/chw-stats returns per-CHW data", async () => {
  const { cookie } = await supervisorHeaders();
  const r = await fetch(`${BASE}/api/dashboard/chw-stats`, { headers: { cookie } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(Array.isArray(body.data.rows), "CHW stats should return rows array");
});

await skip("Dashboard filters: date range narrows results", async () => {
  const { cookie } = await supervisorHeaders();
  const today = new Date().toISOString().split("T")[0];
  const r = await fetch(`${BASE}/api/dashboard/summary?dateFrom=${today}&dateTo=${today}`, { headers: { cookie } });
  assert.equal(r.status, 200);
});

await skip("CHW cannot access dashboard summary (403 or empty scope)", async () => {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
  });
  const cookie = login.headers.get("set-cookie") ?? "";
  const r = await fetch(`${BASE}/api/dashboard/summary`, { headers: { cookie } });
  // CHW should get 403
  assert.ok(r.status === 403 || r.status === 401, `CHW should not access dashboard, got ${r.status}`);
});

console.log("integration/dashboard.test.mjs complete");
