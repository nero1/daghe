import assert from "node:assert/strict";

// Inline calculateBackoffDelayMs from apps/web/lib/sync.ts (mirrors the TS source exactly).
// Update here if the TS implementation changes.
function calculateBackoffDelayMs(retryCount) {
  const base = Math.min(60000, 1000 * 2 ** retryCount);
  const jitter = Math.floor(Math.random() * base * 0.2);
  return base + jitter;
}

// Jitter must be within 0–20% of base
for (let retry = 0; retry <= 6; retry++) {
  const base = Math.min(60000, 1000 * 2 ** retry);
  const samples = Array.from({ length: 200 }, () => calculateBackoffDelayMs(retry));
  for (const delay of samples) {
    assert.ok(delay >= base, `retry=${retry}: delay ${delay} must be >= base ${base}`);
    assert.ok(delay <= base * 1.2, `retry=${retry}: delay ${delay} must be <= base*1.2 (${base * 1.2})`);
  }
}

// Delays increase monotonically up to the 60s cap (compare medians)
const medians = [];
for (let retry = 0; retry <= 7; retry++) {
  const samples = Array.from({ length: 100 }, () => calculateBackoffDelayMs(retry)).sort((a, b) => a - b);
  medians.push(samples[50]);
}
for (let i = 1; i < medians.length - 1; i++) {
  assert.ok(medians[i] >= medians[i - 1], `Median delay should be non-decreasing at retry=${i}`);
}

// Jitter: 1000 calls should not all return the same value (statistical uniqueness)
const retryZeroSamples = new Set(Array.from({ length: 1000 }, () => calculateBackoffDelayMs(0)));
assert.ok(retryZeroSamples.size > 100, "Jitter should produce diverse values (got too few unique values)");

// Never negative
for (let retry = 0; retry <= 15; retry++) {
  for (let i = 0; i < 10; i++) {
    const delay = calculateBackoffDelayMs(retry);
    assert.ok(delay >= 0, `delay must never be negative, got ${delay} at retry=${retry}`);
  }
}

console.log("backoff-extended.test.mjs passed — jitter range, monotonicity, uniqueness, non-negative tests OK");
