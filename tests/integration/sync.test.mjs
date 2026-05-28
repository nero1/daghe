/**
 * Integration tests for case sync endpoint.
 * Requires: INTEGRATION=true TEST_BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... node tests/integration/sync.test.mjs
 */
import assert from "node:assert/strict";

const SKIP = process.env.INTEGRATION !== "true";
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function skip(name, fn) {
  if (SKIP) { console.log(`SKIP [integration/sync] ${name}`); return; }
  try {
    await fn();
    console.log(`PASS [integration/sync] ${name}`);
  } catch (e) {
    console.error(`FAIL [integration/sync] ${name}:`, e.message);
    process.exitCode = 1;
  }
}

function mockCase(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    localCaseId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    patientAgeRange: "15_49",
    symptomCluster: "fever",
    answers: { highFever: true, childUnderFive: false },
    riskLevel: "refer",
    likelyCondition: "Febrile illness",
    recommendation: "Refer to clinic",
    redFlags: [],
    careAdvice: "Rest and fluids",
    referralRequired: true,
    decisionTreeVersion: "v2",
    appVersion: "0.2.0",
    syncStatus: "unsynced",
    ...overrides,
  };
}

async function loginAndGetHeaders() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
  });
  const cookies = login.headers.get("set-cookie") ?? "";
  const csrfR = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookies } });
  const csrfBody = await csrfR.json();
  const csrf = csrfBody.data?.csrfToken ?? "";
  return { cookies, csrf };
}

await skip("POST /api/cases/sync with valid case returns synced status", async () => {
  const { cookies, csrf } = await loginAndGetHeaders();
  const c = mockCase();
  const r = await fetch(`${BASE}/api/cases/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf },
    body: JSON.stringify({ cases: [c] }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.data.results[0].status, "synced");
});

await skip("POST /api/cases/sync same case twice returns duplicate on second", async () => {
  const { cookies, csrf } = await loginAndGetHeaders();
  const c = mockCase();
  await fetch(`${BASE}/api/cases/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf },
    body: JSON.stringify({ cases: [c] }),
  });
  const r2 = await fetch(`${BASE}/api/cases/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf },
    body: JSON.stringify({ cases: [c] }),
  });
  const body = await r2.json();
  assert.equal(body.data.results[0].status, "duplicate", "Second sync of same case should be duplicate");
});

await skip("POST /api/cases/sync without auth returns 401", async () => {
  const r = await fetch(`${BASE}/api/cases/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "fake" },
    body: JSON.stringify({ cases: [mockCase()] }),
  });
  assert.equal(r.status, 401);
});

await skip("POST /api/cases/sync with invalid payload returns 400", async () => {
  const { cookies, csrf } = await loginAndGetHeaders();
  const r = await fetch(`${BASE}/api/cases/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf },
    body: JSON.stringify({ cases: [] }),
  });
  assert.equal(r.status, 400, "Empty cases array should fail validation");
});

await skip("POST /api/cases/sync without CSRF returns 403", async () => {
  const { cookies } = await loginAndGetHeaders();
  const r = await fetch(`${BASE}/api/cases/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ cases: [mockCase()] }),
  });
  assert.equal(r.status, 403);
});

console.log("integration/sync.test.mjs complete");
