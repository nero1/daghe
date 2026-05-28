// Unit tests for applyConfidenceOverride safety function

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

// Inline the function under test (same logic as packages/shared/src/index.ts)
function applyConfidenceOverride(result) {
  if (result.confidenceBand === "LOW" || result.confidenceBand === "REFERENCE_ONLY") {
    return { ...result, classification: "REFER", referralRequired: true };
  }
  return result;
}

function makeResult(classification, confidenceBand, referralRequired = false) {
  return {
    classification,
    confidenceBand,
    inferenceMethod: "tflite",
    confidenceScore: 0.9,
    confidenceSentence: "Test",
    recommendedAction: "Test action",
    referralRequired,
    qualityOverrideUsed: false,
  };
}

console.log("\nai-chain.test.mjs: applyConfidenceOverride safety rules");

// HIGH confidence: no override
const highPositive = applyConfidenceOverride(makeResult("POSITIVE", "HIGH", true));
assert(highPositive.classification === "POSITIVE", "HIGH + POSITIVE: classification unchanged");
assert(highPositive.confidenceBand === "HIGH", "HIGH + POSITIVE: confidenceBand unchanged");

const highNegative = applyConfidenceOverride(makeResult("NEGATIVE", "HIGH", false));
assert(highNegative.classification === "NEGATIVE", "HIGH + NEGATIVE: classification unchanged");

// MODERATE confidence: no override
const modPositive = applyConfidenceOverride(makeResult("POSITIVE", "MODERATE", true));
assert(modPositive.classification === "POSITIVE", "MODERATE + POSITIVE: classification unchanged");

const modNegative = applyConfidenceOverride(makeResult("NEGATIVE", "MODERATE", false));
assert(modNegative.classification === "NEGATIVE", "MODERATE + NEGATIVE: classification unchanged");

// LOW confidence: must override to REFER
const lowNegative = applyConfidenceOverride(makeResult("NEGATIVE", "LOW", false));
assert(lowNegative.classification === "REFER", "LOW + NEGATIVE: MUST override to REFER");
assert(lowNegative.referralRequired === true, "LOW: referralRequired must be true after override");
assert(lowNegative.confidenceBand === "LOW", "LOW: confidenceBand preserved (still LOW)");

const lowPositive = applyConfidenceOverride(makeResult("POSITIVE", "LOW", true));
assert(lowPositive.classification === "REFER", "LOW + POSITIVE: MUST override to REFER");

// REFERENCE_ONLY confidence: must override to REFER
const refNegative = applyConfidenceOverride(makeResult("NEGATIVE", "REFERENCE_ONLY", false));
assert(refNegative.classification === "REFER", "REFERENCE_ONLY + NEGATIVE: MUST override to REFER");
assert(refNegative.referralRequired === true, "REFERENCE_ONLY: referralRequired must be true after override");

const refPositive = applyConfidenceOverride(makeResult("POSITIVE", "REFERENCE_ONLY", true));
assert(refPositive.classification === "REFER", "REFERENCE_ONLY + POSITIVE: MUST override to REFER");

// Idempotent: calling twice returns same result
const once = applyConfidenceOverride(makeResult("NEGATIVE", "LOW", false));
const twice = applyConfidenceOverride(once);
assert(twice.classification === "REFER", "idempotent: double-applying still REFER");
assert(twice.referralRequired === true, "idempotent: double-applying still referralRequired=true");

// Other fields must not be mutated
const original = makeResult("POSITIVE", "LOW", true);
const overridden = applyConfidenceOverride(original);
assert(overridden.inferenceMethod === original.inferenceMethod, "override does not mutate inferenceMethod");
assert(overridden.confidenceScore === original.confidenceScore, "override does not mutate confidenceScore");
assert(overridden.qualityOverrideUsed === original.qualityOverrideUsed, "override does not mutate qualityOverrideUsed");
assert(original.classification === "POSITIVE", "original object not mutated (immutable override)");

console.log(`\nai-chain.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("ai-chain.test.mjs: SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("ai-chain.test.mjs: ALL TESTS PASSED");
}
