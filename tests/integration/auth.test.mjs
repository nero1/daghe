/**
 * Integration tests for auth endpoints.
 * Requires a running app: INTEGRATION=true TEST_BASE_URL=http://localhost:3000 node tests/integration/auth.test.mjs
 */
import assert from "node:assert/strict";

const SKIP = process.env.INTEGRATION !== "true";
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function skip(name, fn) {
  if (SKIP) { console.log(`SKIP [integration/auth] ${name}`); return; }
  try {
    await fn();
    console.log(`PASS [integration/auth] ${name}`);
  } catch (e) {
    console.error(`FAIL [integration/auth] ${name}:`, e.message);
    process.exitCode = 1;
  }
}

async function getCsrf() {
  const r = await fetch(`${BASE}/api/auth/csrf`, { credentials: "include" });
  const body = await r.json();
  return body.data?.csrfToken ?? "";
}

await skip("POST /api/auth/login with valid credentials returns 200", async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
  });
  assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
  const body = await r.json();
  assert.ok(body.data?.user, "Response should include user object");
});

await skip("POST /api/auth/login with invalid credentials returns 401", async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nobody@example.com", password: "wrongpassword" }),
  });
  assert.equal(r.status, 401);
});

await skip("POST /api/auth/login with malformed body returns 400", async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "notanemail", password: "short" }),
  });
  assert.equal(r.status, 400);
});

await skip("POST /api/auth/refresh with valid cookie rotates token", async () => {
  // Login first
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookies = login.headers.get("set-cookie") ?? "";
  const csrf = await getCsrf();
  const r = await fetch(`${BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { cookie: cookies, "x-csrf-token": csrf },
  });
  assert.equal(r.status, 200);
});

await skip("POST /api/auth/logout revokes session", async () => {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
  });
  const cookies = login.headers.get("set-cookie") ?? "";
  const csrf = await getCsrf();
  const logout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: cookies, "x-csrf-token": csrf },
  });
  assert.equal(logout.status, 200);
  // After logout, using the same cookies should fail on protected endpoint
  const check = await fetch(`${BASE}/api/cases`, { headers: { cookie: cookies } });
  assert.equal(check.status, 401, "Revoked session should be rejected");
});

await skip("Protected route without auth returns 401", async () => {
  const r = await fetch(`${BASE}/api/cases`);
  assert.equal(r.status, 401);
});

await skip("Login rate limit triggers after 8 rapid attempts", async () => {
  for (let i = 0; i < 8; i++) {
    await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "flood@example.com", password: "wrongpassword" }),
    });
  }
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "flood@example.com", password: "wrongpassword" }),
  });
  assert.equal(r.status, 429, "9th attempt within window should be rate-limited");
});

await skip("CSRF missing on refresh returns 403", async () => {
  const r = await fetch(`${BASE}/api/auth/refresh`, { method: "POST" });
  assert.equal(r.status, 403);
});

console.log("integration/auth.test.mjs complete");
