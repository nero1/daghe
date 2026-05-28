/**
 * Load tests — only run when LOAD=true.
 * Usage: LOAD=true TEST_BASE_URL=http://localhost:3000 node tests/load/concurrent.test.mjs
 *
 * Manual setup: start the app with `npm run start --workspace=apps/web`, then run this file.
 */
import assert from "node:assert/strict";

const SKIP = process.env.LOAD !== "true";
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const P95_LIMIT_MS = 2000;

async function skip(name, fn) {
  if (SKIP) { console.log(`SKIP [load] ${name}`); return; }
  console.log(`RUN  [load] ${name} ...`);
  try {
    await fn();
    console.log(`PASS [load] ${name}`);
  } catch (e) {
    console.error(`FAIL [load] ${name}:`, e.message);
    process.exitCode = 1;
  }
}

function p95(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

async function timedFetch(url, options) {
  const start = Date.now();
  const r = await fetch(url, options);
  return { status: r.status, durationMs: Date.now() - start };
}

await skip("100 concurrent GET /api/triage/rules — p95 < 2s, no 5xx", async () => {
  const requests = Array.from({ length: 100 }, () => timedFetch(`${BASE}/api/triage/rules`));
  const results = await Promise.all(requests);
  const errors5xx = results.filter((r) => r.status >= 500);
  const durations = results.map((r) => r.durationMs);
  assert.equal(errors5xx.length, 0, `${errors5xx.length} 5xx errors on triage/rules`);
  const p95ms = p95(durations);
  assert.ok(p95ms < P95_LIMIT_MS, `p95 latency ${p95ms}ms exceeds ${P95_LIMIT_MS}ms`);
  console.log(`  → p95: ${p95ms}ms, max: ${Math.max(...durations)}ms`);
});

await skip("50 concurrent POST /api/cases/sync (different cases, skip auth for load) — server handles burst", async () => {
  // This tests unauthenticated request handling under load (401 responses are expected).
  // To test with auth, set TEST_AUTH_COOKIE env var.
  const cookie = process.env.TEST_AUTH_COOKIE ?? "";
  const csrf = process.env.TEST_CSRF_TOKEN ?? "load-test-csrf";

  const requests = Array.from({ length: 50 }, (_, i) => {
    const payload = {
      cases: [{
        id: crypto.randomUUID(), localCaseId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(),
        createdAt: new Date().toISOString(), patientAgeRange: "15_49", symptomCluster: "fever",
        answers: { highFever: true }, riskLevel: "refer", likelyCondition: "Febrile illness",
        recommendation: "Refer", redFlags: [], careAdvice: "Rest", referralRequired: true,
        decisionTreeVersion: "v2", appVersion: "0.2.0",
      }],
    };
    return timedFetch(`${BASE}/api/cases/sync`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "x-csrf-token": csrf },
      body: JSON.stringify(payload),
    });
  });

  const results = await Promise.all(requests);
  const errors5xx = results.filter((r) => r.status >= 500);
  const durations = results.map((r) => r.durationMs);
  assert.equal(errors5xx.length, 0, `${errors5xx.length} 5xx errors on cases/sync burst`);
  const p95ms = p95(durations);
  assert.ok(p95ms < P95_LIMIT_MS, `p95 latency ${p95ms}ms exceeds ${P95_LIMIT_MS}ms`);
  console.log(`  → p95: ${p95ms}ms, max: ${Math.max(...durations)}ms`);
});

await skip("20 concurrent GET /api/dashboard/summary — p95 < 2s, no 5xx", async () => {
  const cookie = process.env.TEST_AUTH_COOKIE ?? "";
  const requests = Array.from({ length: 20 }, () =>
    timedFetch(`${BASE}/api/dashboard/summary`, { headers: { cookie } })
  );
  const results = await Promise.all(requests);
  const errors5xx = results.filter((r) => r.status >= 500);
  const durations = results.map((r) => r.durationMs);
  assert.equal(errors5xx.length, 0, `${errors5xx.length} 5xx errors on dashboard/summary`);
  const p95ms = p95(durations);
  assert.ok(p95ms < P95_LIMIT_MS, `p95 latency ${p95ms}ms exceeds ${P95_LIMIT_MS}ms`);
  console.log(`  → p95: ${p95ms}ms, max: ${Math.max(...durations)}ms`);
});

await skip("Rate limiter handles 30 rapid sync requests from same IP — returns 429 eventually", async () => {
  const cookie = process.env.TEST_AUTH_COOKIE ?? "";
  const csrf = process.env.TEST_CSRF_TOKEN ?? "load-test-csrf";
  const results = [];
  for (let i = 0; i < 35; i++) {
    const r = await timedFetch(`${BASE}/api/cases/sync`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "x-csrf-token": csrf },
      body: JSON.stringify({ cases: [{ id: crypto.randomUUID(), localCaseId: "x", idempotencyKey: crypto.randomUUID() }] }),
    });
    results.push(r.status);
  }
  const rateLimited = results.filter((s) => s === 429);
  assert.ok(rateLimited.length > 0, "At least some requests should be rate-limited after 30 per minute");
  console.log(`  → ${rateLimited.length}/35 requests were rate-limited`);
});

console.log("load/concurrent.test.mjs complete");
