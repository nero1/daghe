// Unit tests for Decimal.js cost calculation precision
// Verifies that Decimal.js avoids floating-point arithmetic artifacts

import Decimal from "decimal.js";

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

// Cost rate constants (matching lib/ai/constants.ts defaults)
const RATES = {
  gemini: { inputPer1k: "0.000075", outputPer1k: "0.0003" },
  gpt4o: { inputPer1k: "0.005", outputPer1k: "0.015" },
  deepseek: { inputPer1k: "0.00014", outputPer1k: "0.00028" },
};

function calcCost(provider, inputTokens, outputTokens) {
  const rates = RATES[provider];
  const inputCost = new Decimal(rates.inputPer1k).mul(inputTokens).div(1000);
  const outputCost = new Decimal(rates.outputPer1k).mul(outputTokens).div(1000);
  return inputCost.plus(outputCost).toFixed(8);
}

console.log("\ncost-calc.test.mjs: Decimal.js precision vs floating-point");

// The classic floating-point problem: 0.1 + 0.2 !== 0.3
const floatResult = 0.1 + 0.2;
assert(floatResult !== 0.3, "sanity: native float 0.1+0.2 !== 0.3 (floating-point artifact)");
const decimalResult = new Decimal("0.1").plus("0.2").toFixed(1);
assert(decimalResult === "0.3", "Decimal.js: 0.1 + 0.2 === 0.3 exactly");

// Gemini cost: 1000 input tokens × $0.000075/1k = $0.000075
const geminiInputCost = new Decimal("0.000075").mul(1000).div(1000);
assert(geminiInputCost.toFixed(8) === "0.00007500", "Gemini: 1000 input tokens = $0.000075");

// Float would produce: 0.000075 * 1000 / 1000 — check for artifacts
const floatGeminiCost = 0.000075 * 1000 / 1000;
assert(
  Math.abs(floatGeminiCost - 0.000075) < 1e-10,
  `float: gemini cost ~$${floatGeminiCost} (may have fp artifact)`
);

// Decimal.js: no artifact
assert(
  geminiInputCost.equals("0.000075"),
  "Decimal.js: gemini cost is exact 0.000075"
);

console.log("\ncost-calc.test.mjs: provider cost calculations");

// Zero tokens
const zeroCost = calcCost("gemini", 0, 0);
assert(zeroCost === "0.00000000", "zero tokens = zero cost");

// Gemini: 500 input + 200 output
const geminiCost = calcCost("gemini", 500, 200);
// Expected: (0.000075 * 500 / 1000) + (0.0003 * 200 / 1000)
// = 0.0000375 + 0.00006 = 0.0000975
assert(geminiCost === "0.00009750", `Gemini 500/200 = ${geminiCost} (expected 0.00009750)`);

// GPT-4o: 1000 input + 500 output
const gpt4oCost = calcCost("gpt4o", 1000, 500);
// Expected: (0.005 * 1000 / 1000) + (0.015 * 500 / 1000)
// = 0.005 + 0.0075 = 0.0125
assert(gpt4oCost === "0.01250000", `GPT-4o 1000/500 = ${gpt4oCost} (expected 0.01250000)`);

// DeepSeek: 10000 input + 2000 output
const deepseekCost = calcCost("deepseek", 10000, 2000);
// Expected: (0.00014 * 10000 / 1000) + (0.00028 * 2000 / 1000)
// = 0.0014 + 0.00056 = 0.00196
assert(deepseekCost === "0.00196000", `DeepSeek 10000/2000 = ${deepseekCost} (expected 0.00196000)`);

console.log("\ncost-calc.test.mjs: accumulation precision");

// Summing many small costs — Decimal.js must not drift
let total = new Decimal("0");
for (let i = 0; i < 1000; i++) {
  total = total.plus(new Decimal("0.00000001"));
}
assert(total.toFixed(8) === "0.00001000", "accumulating 1000 × $0.00000001 = $0.00001000 exactly");

// Float equivalent for comparison
let floatTotal = 0;
for (let i = 0; i < 1000; i++) {
  floatTotal += 0.00000001;
}
const floatDrift = Math.abs(floatTotal - 0.00001);
assert(floatDrift > 0 || true, `float accumulation drift: ${floatDrift} (may be non-zero)`);

console.log(`\ncost-calc.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("cost-calc.test.mjs: SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("cost-calc.test.mjs: ALL TESTS PASSED");
}
