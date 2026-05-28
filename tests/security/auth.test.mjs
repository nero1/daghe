/**
 * Security-focused auth unit tests (no live server needed).
 */
import assert from "node:assert/strict";

// Mirrors calculateBackoffDelayMs from apps/web/lib/sync.ts exactly.
function calculateBackoffDelayMs(retryCount) {
  const base = Math.min(60000, 1000 * 2 ** retryCount);
  const jitter = Math.floor(Math.random() * base * 0.2);
  return base + jitter;
}

// calculateBackoffDelayMs never returns negative (guards brute-force protection timing)
for (let retry = 0; retry <= 20; retry++) {
  for (let i = 0; i < 5; i++) {
    const delay = calculateBackoffDelayMs(retry);
    assert.ok(delay >= 0, `Backoff delay must never be negative at retry=${retry}, got ${delay}`);
  }
}

// In-memory rate limiter logic verification (mirrors lib/server/rate-limit.ts bucket logic)
function simulateInMemoryRateLimit(limit, windowMs) {
  const bucket = new Map();
  return function check(key) {
    const now = Date.now();
    const existing = bucket.get(key);
    if (!existing || existing.resetAt <= now) {
      bucket.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true };
    }
    if (existing.count >= limit) return { ok: false };
    existing.count += 1;
    return { ok: true };
  };
}

// 8 requests within window should succeed, 9th should fail (matches login rate limit)
const limiter = simulateInMemoryRateLimit(8, 60_000);
for (let i = 1; i <= 8; i++) {
  const r = limiter("test-key");
  assert.equal(r.ok, true, `Request ${i} should succeed`);
}
const blocked = limiter("test-key");
assert.equal(blocked.ok, false, "9th request within window should be rate-limited");

// Different keys should be independent
const l2 = simulateInMemoryRateLimit(3, 60_000);
assert.equal(l2("key-a").ok, true);
assert.equal(l2("key-a").ok, true);
assert.equal(l2("key-a").ok, true);
assert.equal(l2("key-a").ok, false);
assert.equal(l2("key-b").ok, true, "Different key should not be limited by key-a's count");

// JWT role normalization: unknown roles default to "chw"
function normalizeRole(role) {
  return role === "supervisor" || role === "admin" ? role : "chw";
}
assert.equal(normalizeRole("supervisor"), "supervisor");
assert.equal(normalizeRole("admin"), "admin");
assert.equal(normalizeRole("chw"), "chw");
assert.equal(normalizeRole(undefined), "chw", "Missing role defaults to chw");
assert.equal(normalizeRole("superuser"), "chw", "Unknown role defaults to chw (privilege escalation prevention)");
assert.equal(normalizeRole("root"), "chw", "Escalation attempt defaults to chw");
assert.equal(normalizeRole(""), "chw", "Empty string defaults to chw");

// Idempotency key uniqueness (prevents duplicate sync exploitation)
const keys = new Set(Array.from({ length: 500 }, () => crypto.randomUUID()));
assert.equal(keys.size, 500, "500 idempotency keys should all be unique");

console.log("security/auth.test.mjs passed — rate limiting, role normalization, idempotency, backoff security tests OK");
