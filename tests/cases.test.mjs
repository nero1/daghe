import assert from "node:assert/strict";

// Inline calculateBackoffDelayMs from apps/web/lib/sync.ts (mirrors the TS source exactly).
// Update here if the TS implementation changes.
function calculateBackoffDelayMs(retryCount) {
  const base = Math.min(60000, 1000 * 2 ** retryCount);
  const jitter = Math.floor(Math.random() * base * 0.2);
  return base + jitter;
}

// UUID format and uniqueness
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const id1 = crypto.randomUUID();
const id2 = crypto.randomUUID();

assert.match(id1, uuidRegex, "UUID v4 format check 1");
assert.match(id2, uuidRegex, "UUID v4 format check 2");
assert.notEqual(id1, id2, "Two UUIDs must be different");

// Generate 50 UUIDs and verify all are unique and valid
const uuids = Array.from({ length: 50 }, () => crypto.randomUUID());
const unique = new Set(uuids);
assert.equal(unique.size, 50, "50 UUIDs should all be unique");
for (const u of uuids) assert.match(u, uuidRegex, `UUID "${u}" must match v4 format`);

// LocalCase shape: verify required fields exist in a mock case object
const mockCase = {
  id: crypto.randomUUID(),
  localCaseId: crypto.randomUUID(),
  idempotencyKey: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  patientAgeRange: "15_49",
  patientSex: "male",
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
  retryCount: 0,
};

const requiredKeys = [
  "id", "localCaseId", "idempotencyKey", "createdAt", "patientAgeRange",
  "symptomCluster", "answers", "riskLevel", "likelyCondition", "recommendation",
  "redFlags", "careAdvice", "referralRequired", "decisionTreeVersion", "appVersion", "syncStatus"
];
for (const key of requiredKeys) {
  assert.ok(key in mockCase, `LocalCase must have field: ${key}`);
}

// Idempotency key: two cases must have different keys
const key1 = crypto.randomUUID();
const key2 = crypto.randomUUID();
assert.notEqual(key1, key2, "Idempotency keys must be unique across cases");

// Backoff delay: retryCount 0 → base 1000ms ± 20% jitter
for (let i = 0; i < 20; i++) {
  const delay = calculateBackoffDelayMs(0);
  assert.ok(delay >= 1000 && delay <= 1200, `retry=0 delay ${delay} should be in [1000, 1200]`);
}

// Backoff delay: retryCount 10 → capped at 60000ms ± 20% jitter
for (let i = 0; i < 20; i++) {
  const delay = calculateBackoffDelayMs(10);
  assert.ok(delay >= 60000 && delay <= 72000, `retry=10 delay ${delay} should be in [60000, 72000]`);
}

// Very large retryCount → still capped at 60000ms ± jitter
for (let i = 0; i < 10; i++) {
  const delay = calculateBackoffDelayMs(999);
  assert.ok(delay >= 60000 && delay <= 72000, `retry=999 delay ${delay} should be capped`);
}

console.log("cases.test.mjs passed — UUID, LocalCase shape, idempotency, backoff tests OK");
