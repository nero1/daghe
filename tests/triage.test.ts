import assert from "node:assert/strict";
import { evaluateTriage } from "../packages/shared/src/index";

const result = evaluateTriage({
  cluster: "fever",
  childUnderFive: true,
  unconscious: false,
  severeDehydration: false,
  highFever: true
});

assert.equal(result.riskLevel, "urgent");
console.log("triage.test.ts passed");

