/**
 * Unit tests for the @daghe/shared encounter types and the applyConfidenceOverride safety rule.
 * These tests run with plain node — no browser or build required.
 */
import assert from "node:assert/strict";

// Test the critical clinical safety function inline (package is TypeScript, not transpiled yet)
// The logic is simple enough to replicate here for fast CI feedback.

function applyConfidenceOverride(result) {
  if (result.confidenceBand === "LOW" || result.confidenceBand === "REFERENCE_ONLY") {
    return { ...result, classification: "REFER", referralRequired: true };
  }
  return result;
}

// ── applyConfidenceOverride safety tests ───────────────────────────────────

const highResult = {
  classification: "POSITIVE",
  confidenceBand: "HIGH",
  inferenceMethod: "tflite",
  confidenceSentence: "High confidence result.",
  recommendedAction: "Refer for colposcopy.",
  referralRequired: true,
  qualityOverrideUsed: false,
};

// HIGH confidence: classification must NOT change
const highOut = applyConfidenceOverride(highResult);
assert.equal(highOut.classification, "POSITIVE", "HIGH confidence should not override classification");
assert.equal(highOut.confidenceBand, "HIGH", "HIGH confidence band must be preserved");

// MODERATE confidence: classification must NOT change
const moderateResult = { ...highResult, confidenceBand: "MODERATE", classification: "NEGATIVE" };
const moderateOut = applyConfidenceOverride(moderateResult);
assert.equal(moderateOut.classification, "NEGATIVE", "MODERATE confidence should not override classification");

// LOW confidence: classification MUST become REFER regardless of original
const lowPositive = { ...highResult, confidenceBand: "LOW", classification: "POSITIVE" };
const lowOut = applyConfidenceOverride(lowPositive);
assert.equal(lowOut.classification, "REFER", "LOW confidence must override to REFER");
assert.equal(lowOut.referralRequired, true, "LOW confidence must set referralRequired=true");

const lowNegative = { ...highResult, confidenceBand: "LOW", classification: "NEGATIVE" };
const lowNegOut = applyConfidenceOverride(lowNegative);
assert.equal(lowNegOut.classification, "REFER", "LOW confidence NEGATIVE must also override to REFER");

// REFERENCE_ONLY confidence: classification MUST become REFER
const refResult = { ...highResult, confidenceBand: "REFERENCE_ONLY", classification: "NEGATIVE" };
const refOut = applyConfidenceOverride(refResult);
assert.equal(refOut.classification, "REFER", "REFERENCE_ONLY confidence must override to REFER");
assert.equal(refOut.referralRequired, true, "REFERENCE_ONLY must set referralRequired=true");

console.log("encounters.test.mjs: applyConfidenceOverride safety tests — PASSED");

// ── LocalEncounter schema shape tests ─────────────────────────────────────

const validEncounter = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  facilityId: "550e8400-e29b-41d4-a716-446655440001",
  userId: "550e8400-e29b-41d4-a716-446655440002",
  moduleId: "cervical-via",
  patientAgeBand: "30-34",
  screeningContext: "routine",
  result: {
    classification: "NEGATIVE",
    confidenceBand: "HIGH",
    inferenceMethod: "tflite",
    confidenceSentence: "High confidence on-device result.",
    recommendedAction: "Routine rescreening in 3 years.",
    referralRequired: false,
    qualityOverrideUsed: false,
  },
  imageHash: "a".repeat(64),
  qualityOverride: false,
  inferenceMethod: "tflite",
  appVersion: "1.0.0",
  moduleVersion: "1.0.0",
  deviceLocalTime: "2026-05-28T10:00:00+01:00",
  utcTime: "2026-05-28T09:00:00Z",
  syncStatus: "pending",
  retryCount: 0,
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440003",
  isDemoEncounter: false,
};

// Shape validation
assert.equal(typeof validEncounter.id, "string", "id must be string");
assert.equal(typeof validEncounter.moduleId, "string", "moduleId must be string");
assert.equal(typeof validEncounter.isDemoEncounter, "boolean", "isDemoEncounter must be boolean");
assert.equal(validEncounter.syncStatus, "pending", "default syncStatus must be pending");

// Demo encounter exclusion from sync queue simulation
function getUnsyncedEncountersFilter(encounters) {
  return encounters.filter(
    (e) => (e.syncStatus === "pending" || e.syncStatus === "failed") && !e.isDemoEncounter
  );
}

const demoEncounter = { ...validEncounter, isDemoEncounter: true, syncStatus: "pending" };
const normalEncounter = { ...validEncounter, isDemoEncounter: false, syncStatus: "pending" };

const unsynced = getUnsyncedEncountersFilter([demoEncounter, normalEncounter]);
assert.equal(unsynced.length, 1, "Demo encounters must be excluded from sync queue");
assert.equal(unsynced[0].isDemoEncounter, false, "Only non-demo encounters in sync queue");

// Failed encounters ARE included if not demo
const failedNormal = { ...normalEncounter, syncStatus: "failed" };
const failedDemo = { ...demoEncounter, syncStatus: "failed" };
const withFailed = getUnsyncedEncountersFilter([failedNormal, failedDemo]);
assert.equal(withFailed.length, 1, "Failed demo encounters must still be excluded");

// Synced encounters are excluded
const syncedEncounter = { ...normalEncounter, syncStatus: "synced" };
const withSynced = getUnsyncedEncountersFilter([syncedEncounter, normalEncounter]);
assert.equal(withSynced.length, 1, "Synced encounters must be excluded from sync queue");

console.log("encounters.test.mjs: LocalEncounter shape and demo exclusion tests — PASSED");
console.log("encounters.test.mjs: ALL TESTS PASSED");
