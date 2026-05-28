import assert from "node:assert/strict";
import { z } from "zod";

// Inline Zod schemas from packages/shared/src/index.ts so this runs with plain `node`.
// Keep in sync with the canonical TS definitions if they change.
const symptomClusterSchema = z.enum([
  "fever", "breathing", "vomiting_diarrhea", "confusion_collapse", "skin_rash", "other",
]);

const triageInputSchema = z.object({
  cluster: symptomClusterSchema,
  childUnderFive: z.boolean(),
  unconscious: z.boolean(),
  severeDehydration: z.boolean(),
  highFever: z.boolean(),
  rainedHeavily: z.boolean(),
  breathingFast: z.boolean(),
  dustSmokeExposure: z.boolean(),
  persistentVomiting: z.boolean(),
  bloodInStool: z.boolean(),
  seizures: z.boolean(),
  maternalDangerSigns: z.boolean(),
  malnutritionSigns: z.boolean(),
});

// Valid full input parses successfully
const valid = triageInputSchema.safeParse({
  cluster: "fever", childUnderFive: true, unconscious: false, severeDehydration: false,
  highFever: true, rainedHeavily: false, breathingFast: false, dustSmokeExposure: false,
  persistentVomiting: false, bloodInStool: false, seizures: false, maternalDangerSigns: false, malnutritionSigns: false,
});
assert.equal(valid.success, true, "valid input should parse");

// Missing required field fails
const missingCluster = triageInputSchema.safeParse({ childUnderFive: true, unconscious: false });
assert.equal(missingCluster.success, false, "missing cluster should fail");

// Invalid cluster enum fails
const badCluster = triageInputSchema.safeParse({
  cluster: "headache", childUnderFive: false, unconscious: false, severeDehydration: false,
  highFever: false, rainedHeavily: false, breathingFast: false, dustSmokeExposure: false,
  persistentVomiting: false, bloodInStool: false, seizures: false, maternalDangerSigns: false, malnutritionSigns: false,
});
assert.equal(badCluster.success, false, "invalid cluster enum should fail");

// Injection string rejected by enum
const injected = symptomClusterSchema.safeParse("<script>alert(1)</script>");
assert.equal(injected.success, false, "XSS string should fail enum validation");

// Boolean fields reject non-boolean
const nonBool = triageInputSchema.safeParse({
  cluster: "fever", childUnderFive: "yes", unconscious: 0, severeDehydration: false,
  highFever: false, rainedHeavily: false, breathingFast: false, dustSmokeExposure: false,
  persistentVomiting: false, bloodInStool: false, seizures: false, maternalDangerSigns: false, malnutritionSigns: false,
});
assert.equal(nonBool.success, false, "non-boolean values should fail");

// All boolean flags false is valid
const allFalse = triageInputSchema.safeParse({
  cluster: "other", childUnderFive: false, unconscious: false, severeDehydration: false,
  highFever: false, rainedHeavily: false, breathingFast: false, dustSmokeExposure: false,
  persistentVomiting: false, bloodInStool: false, seizures: false, maternalDangerSigns: false, malnutritionSigns: false,
});
assert.equal(allFalse.success, true, "all-false flags should be valid");

// All 6 valid clusters are accepted
for (const c of ["fever", "breathing", "vomiting_diarrhea", "confusion_collapse", "skin_rash", "other"]) {
  const r = symptomClusterSchema.safeParse(c);
  assert.equal(r.success, true, `cluster "${c}" should be valid`);
}

// SQL injection string rejected
const sqlInject = symptomClusterSchema.safeParse("fever' OR '1'='1");
assert.equal(sqlInject.success, false, "SQL injection string should fail enum validation");

console.log("validation.test.mjs passed — all schema tests OK");
