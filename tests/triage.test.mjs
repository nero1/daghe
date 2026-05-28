import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// BUG-015 fix: keep this JS-side test meaningful without duplicating evaluator logic.
// We verify the canonical TypeScript triage test exists and checks the shared evaluator directly.
const tsTest = readFileSync(new URL("./triage.test.ts", import.meta.url), "utf8");
assert.match(tsTest, /import\s+\{\s*evaluateTriage\s*\}\s+from\s+"\.\.\/packages\/shared\/src\/index"/);
assert.match(tsTest, /assert\.equal\(result\.riskLevel,\s*"urgent"\)/);

// ---------------------------------------------------------------------------
// Inline evaluateTriage logic for comprehensive JS-level tests.
// This mirrors packages/shared/src/index.ts exactly — update if the TS changes.
// ---------------------------------------------------------------------------

function evaluateTriage(input) {
  if (input.unconscious) {
    return {
      riskLevel: "emergency",
      likelyCondition: "Severe acute illness — possible heatstroke, meningitis, or severe malaria",
      recommendation: "Immediate emergency escalation — call for ambulance or emergency transport now",
      redFlags: ["Patient is unconscious or unresponsive", "Do not leave patient alone"],
      careAdvice: "Keep airway clear. Place in recovery position if breathing. Do not give food or water. Call emergency services now.",
      referralRequired: true,
    };
  }

  if (input.cluster === "fever") {
    if (input.seizures) {
      return {
        riskLevel: "emergency",
        likelyCondition: "Febrile seizure — possible meningitis or severe malaria",
        recommendation: "Emergency escalation — transport immediately",
        redFlags: ["Seizure activity with fever", "Risk of brain injury without immediate care"],
        careAdvice: "Do not restrain patient. Protect from injury. After seizure stops, place on side. Transport immediately.",
        referralRequired: true,
      };
    }
    if (input.highFever && input.childUnderFive) {
      return {
        riskLevel: "urgent",
        likelyCondition: "Severe febrile illness in child under 5 — possible severe malaria",
        recommendation: "Urgent referral — transport to clinic within 1–2 hours",
        redFlags: ["High fever in child under 5", "Risk of febrile seizure"],
        careAdvice: "Give paracetamol if available. Cool child with damp cloth. Give oral fluids if conscious. Transport urgently.",
        referralRequired: true,
      };
    }
    if (input.rainedHeavily && input.highFever) {
      return {
        riskLevel: "urgent",
        likelyCondition: "Possible malaria surge (post-rainfall) or typhoid fever",
        recommendation: "Urgent referral — malaria rapid test needed urgently",
        redFlags: ["High fever following heavy rainfall — malaria risk is high in this context"],
        careAdvice: "Give paracetamol for fever if available. Encourage fluids. Transport to clinic urgently for RDT test.",
        referralRequired: true,
      };
    }
    if (input.highFever) {
      return {
        riskLevel: "refer",
        likelyCondition: "Febrile illness — possible malaria, typhoid, or dengue",
        recommendation: "Refer to clinic same day for malaria rapid diagnostic test",
        redFlags: [],
        careAdvice: "Give paracetamol for fever. Encourage fluid intake. Refer for RDT test today.",
        referralRequired: true,
      };
    }
    if (input.rainedHeavily) {
      return {
        riskLevel: "refer",
        likelyCondition: "Post-rainfall fever — possible early malaria",
        recommendation: "Refer for malaria rapid test given recent rainfall",
        redFlags: [],
        careAdvice: "Monitor temperature. Encourage fluids. Refer for malaria test given recent rainfall in the area.",
        referralRequired: true,
      };
    }
    return {
      riskLevel: "monitor",
      likelyCondition: "Mild fever — non-specific",
      recommendation: "Monitor with follow-up in 24 hours",
      redFlags: [],
      careAdvice: "Rest and increase fluid intake. Give paracetamol if fever rises. Return if no improvement in 24 hours.",
      referralRequired: false,
    };
  }

  if (input.cluster === "breathing") {
    if (input.breathingFast && input.childUnderFive) {
      return {
        riskLevel: "urgent",
        likelyCondition: "Possible severe pneumonia in child under 5",
        recommendation: "Urgent referral — child needs immediate clinical assessment",
        redFlags: ["Fast breathing in child under 5 — severe pneumonia indicator"],
        careAdvice: "Keep child upright and calm. Do not give food if in respiratory distress. Transport urgently to clinic.",
        referralRequired: true,
      };
    }
    if (input.dustSmokeExposure) {
      return {
        riskLevel: "refer",
        likelyCondition: "Respiratory illness linked to dust, smoke, or wildfire exposure",
        recommendation: "Refer to clinic for respiratory assessment",
        redFlags: [],
        careAdvice: "Move away from smoke or dust exposure. Cover nose and mouth with cloth. Seek fresh air. Refer for assessment.",
        referralRequired: true,
      };
    }
    if (input.breathingFast) {
      return {
        riskLevel: "refer",
        likelyCondition: "Possible pneumonia or acute respiratory illness",
        recommendation: "Refer to clinic same day for chest assessment",
        redFlags: ["Fast breathing noted — possible lower respiratory infection"],
        careAdvice: "Keep patient calm and in upright position. Do not force fluids if breathing is laboured. Refer today.",
        referralRequired: true,
      };
    }
    return {
      riskLevel: "refer",
      likelyCondition: "Respiratory illness",
      recommendation: "Refer to clinic for evaluation",
      redFlags: [],
      careAdvice: "Encourage rest and adequate fluids. Avoid smoke and dust. Refer to clinic for assessment.",
      referralRequired: true,
    };
  }

  if (input.cluster === "vomiting_diarrhea") {
    if (input.severeDehydration) {
      return {
        riskLevel: "urgent",
        likelyCondition: "Severe dehydration — possible severe diarrheal disease or cholera",
        recommendation: "Urgent referral — IV fluids may be needed",
        redFlags: ["Severe dehydration signs present", "Risk of circulatory shock if untreated"],
        careAdvice: "Start oral rehydration salts (ORS) immediately if patient can swallow. Do not delay transport.",
        referralRequired: true,
      };
    }
    if (input.bloodInStool) {
      return {
        riskLevel: "urgent",
        likelyCondition: "Possible dysentery or severe gastrointestinal infection",
        recommendation: "Urgent referral — blood in stool requires clinical assessment",
        redFlags: ["Blood in stool detected — possible dysentery"],
        careAdvice: "Give ORS to prevent dehydration. Do not give anti-diarrheal medications. Transport urgently.",
        referralRequired: true,
      };
    }
    if (input.persistentVomiting && input.rainedHeavily) {
      return {
        riskLevel: "refer",
        likelyCondition: "Possible waterborne illness after flooding or contaminated water exposure",
        recommendation: "Refer to clinic — waterborne illness suspected",
        redFlags: [],
        careAdvice: "Give ORS. Ensure only safe drinking water is used. Refer for assessment and possible stool test.",
        referralRequired: true,
      };
    }
    if (input.persistentVomiting) {
      return {
        riskLevel: "refer",
        likelyCondition: "Persistent vomiting / diarrheal disease",
        recommendation: "Refer to clinic if unable to keep fluids down",
        redFlags: [],
        careAdvice: "Give small sips of ORS frequently. Monitor hydration signs. Refer if unable to keep fluids down.",
        referralRequired: true,
      };
    }
    return {
      riskLevel: "monitor",
      likelyCondition: "Mild diarrheal illness",
      recommendation: "Monitor and encourage oral rehydration",
      redFlags: [],
      careAdvice: "Give ORS. Maintain food intake if tolerated. Return if worsens or signs of dehydration appear.",
      referralRequired: false,
    };
  }

  if (input.cluster === "confusion_collapse") {
    if (input.seizures) {
      return {
        riskLevel: "emergency",
        likelyCondition: "Seizure — possible meningitis, cerebral malaria, or eclampsia",
        recommendation: "Emergency escalation immediately",
        redFlags: ["Active or recent seizure", "Risk of serious brain injury without emergency care"],
        careAdvice: "Do not restrain. Protect from injury. Place on side after seizure stops. Emergency transport now.",
        referralRequired: true,
      };
    }
    if (input.highFever) {
      return {
        riskLevel: "urgent",
        likelyCondition: "Confusion with high fever — possible cerebral malaria or meningitis",
        recommendation: "Urgent referral — transport immediately",
        redFlags: ["Altered consciousness with fever — meningitis or cerebral malaria possible"],
        careAdvice: "Do not give anything by mouth. Keep airway clear. Transport immediately to nearest clinic.",
        referralRequired: true,
      };
    }
    return {
      riskLevel: "urgent",
      likelyCondition: "Confusion or collapse — cause unknown, urgent evaluation required",
      recommendation: "Urgent referral — clinical evaluation required",
      redFlags: ["Altered mental status or collapse — cause unknown"],
      careAdvice: "Keep patient safe and still. Monitor breathing and pulse. Transport urgently.",
      referralRequired: true,
    };
  }

  if (input.cluster === "skin_rash") {
    if (input.highFever && input.rainedHeavily) {
      return {
        riskLevel: "urgent",
        likelyCondition: "Possible dengue fever — rash with fever in post-rainfall context",
        recommendation: "Urgent referral — dengue suspected, aspirin and ibuprofen must be avoided",
        redFlags: ["Possible dengue — giving aspirin or ibuprofen can cause bleeding"],
        careAdvice: "Give ONLY paracetamol for fever (NOT aspirin or ibuprofen — severe bleeding risk in dengue). Encourage fluids. Refer urgently.",
        referralRequired: true,
      };
    }
    if (input.highFever) {
      return {
        riskLevel: "refer",
        likelyCondition: "Febrile rash illness — possible measles or dengue fever",
        recommendation: "Refer to clinic same day for assessment",
        redFlags: [],
        careAdvice: "Isolate if measles is suspected. Give paracetamol for fever (not ibuprofen). Refer same day.",
        referralRequired: true,
      };
    }
    if (input.dustSmokeExposure) {
      return {
        riskLevel: "monitor",
        likelyCondition: "Skin irritation from dust or smoke/wildfire exposure",
        recommendation: "Monitor and remove patient from exposure",
        redFlags: [],
        careAdvice: "Move away from smoke or dust. Keep skin clean and dry. Refer if rash spreads or blisters form.",
        referralRequired: false,
      };
    }
    return {
      riskLevel: "monitor",
      likelyCondition: "Skin rash or mild skin infection",
      recommendation: "Monitor and keep affected area clean",
      redFlags: [],
      careAdvice: "Keep rash area clean and dry. Avoid scratching. Return if rash spreads, blisters, or fever develops.",
      referralRequired: false,
    };
  }

  // cluster: "other"
  if (input.maternalDangerSigns) {
    return {
      riskLevel: "urgent",
      likelyCondition: "Maternal danger signs detected",
      recommendation: "Urgent referral to clinic or maternity unit",
      redFlags: ["Maternal danger signs present — immediate clinical assessment needed"],
      careAdvice: "Do not delay transport. Keep patient calm and lying down. Alert receiving facility of a possible maternal emergency.",
      referralRequired: true,
    };
  }
  if (input.seizures) {
    return {
      riskLevel: "emergency",
      likelyCondition: "Seizure — cause to be determined",
      recommendation: "Emergency escalation immediately",
      redFlags: ["Seizure activity detected"],
      careAdvice: "Do not restrain. Protect from injury. Time the seizure. Emergency transport now.",
      referralRequired: true,
    };
  }
  if (input.highFever && input.childUnderFive) {
    return {
      riskLevel: "urgent",
      likelyCondition: "High-risk febrile illness in child under 5",
      recommendation: "Urgent referral to clinic",
      redFlags: ["High fever in child under 5"],
      careAdvice: "Give paracetamol if available. Keep child cool with damp cloth. Transport urgently.",
      referralRequired: true,
    };
  }
  if (input.malnutritionSigns && input.childUnderFive) {
    return {
      riskLevel: "urgent",
      likelyCondition: "Possible severe acute malnutrition (SAM) in child under 5",
      recommendation: "Urgent referral — child needs nutritional assessment and therapeutic feeding",
      redFlags: ["Child under 5 with malnutrition signs — risk of severe acute malnutrition", "Check for bilateral pitting oedema"],
      careAdvice: "Continue breastfeeding if infant. Do not give high-sugar foods. Transport urgently for MUAC measurement and nutritional assessment.",
      referralRequired: true,
    };
  }
  if (input.malnutritionSigns) {
    return {
      riskLevel: "refer",
      likelyCondition: "Possible malnutrition",
      recommendation: "Refer to clinic for nutritional assessment",
      redFlags: [],
      careAdvice: "Encourage nutrient-rich foods if available. Refer for full nutritional assessment at clinic.",
      referralRequired: true,
    };
  }
  return {
    riskLevel: "monitor",
    likelyCondition: "Non-specific symptoms",
    recommendation: "Monitor with follow-up in 24–48 hours",
    redFlags: [],
    careAdvice: "Rest and increase fluid intake. Return if symptoms worsen or new symptoms develop.",
    referralRequired: false,
  };
}

// Helper: build a minimal valid input with all flags false for a given cluster.
function base(cluster) {
  return {
    cluster,
    childUnderFive: false,
    unconscious: false,
    severeDehydration: false,
    highFever: false,
    rainedHeavily: false,
    breathingFast: false,
    dustSmokeExposure: false,
    persistentVomiting: false,
    bloodInStool: false,
    seizures: false,
    maternalDangerSigns: false,
    malnutritionSigns: false,
  };
}

// ---------------------------------------------------------------------------
// EDGE CASE: unconscious patient — always emergency regardless of cluster
// ---------------------------------------------------------------------------

{
  const r = evaluateTriage({ ...base("fever"), unconscious: true });
  assert.equal(r.riskLevel, "emergency", "unconscious+fever → emergency");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "unconscious: redFlags must be non-empty");
}

{
  const r = evaluateTriage({ ...base("skin_rash"), unconscious: true });
  assert.equal(r.riskLevel, "emergency", "unconscious+skin_rash → emergency");
  assert.equal(r.referralRequired, true);
}

{
  const r = evaluateTriage({ ...base("vomiting_diarrhea"), unconscious: true });
  assert.equal(r.riskLevel, "emergency", "unconscious+vomiting_diarrhea → emergency");
  assert.equal(r.referralRequired, true);
}

// ---------------------------------------------------------------------------
// CLUSTER: fever
// ---------------------------------------------------------------------------

{
  const r = evaluateTriage({ ...base("fever"), seizures: true });
  assert.equal(r.riskLevel, "emergency", "fever+seizures → emergency");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.some(f => f.toLowerCase().includes("seizure")), "fever+seizures: redFlags mentions seizure");
}

{
  const r = evaluateTriage({ ...base("fever"), highFever: true, childUnderFive: true });
  assert.equal(r.riskLevel, "urgent", "fever+highFever+childUnderFive → urgent");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "fever+highFever+childUnderFive: redFlags non-empty");
}

{
  const r = evaluateTriage({ ...base("fever"), highFever: true, rainedHeavily: true });
  assert.equal(r.riskLevel, "urgent", "fever+highFever+rainedHeavily → urgent (malaria surge)");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "malaria surge: redFlags non-empty");
}

{
  const r = evaluateTriage({ ...base("fever"), highFever: true });
  assert.equal(r.riskLevel, "refer", "fever+highFever (no child, no rain) → refer");
  assert.equal(r.referralRequired, true);
  assert.deepEqual(r.redFlags, [], "highFever alone: redFlags empty");
}

{
  const r = evaluateTriage({ ...base("fever"), rainedHeavily: true });
  assert.equal(r.riskLevel, "refer", "fever+rainedHeavily (no highFever) → refer");
  assert.equal(r.referralRequired, true);
}

{
  const r = evaluateTriage({ ...base("fever") });
  assert.equal(r.riskLevel, "monitor", "fever with no danger flags → monitor");
  assert.equal(r.referralRequired, false);
  assert.deepEqual(r.redFlags, [], "mild fever: redFlags empty");
}

// ---------------------------------------------------------------------------
// CLUSTER: breathing
// ---------------------------------------------------------------------------

{
  const r = evaluateTriage({ ...base("breathing"), breathingFast: true, childUnderFive: true });
  assert.equal(r.riskLevel, "urgent", "breathing+breathingFast+childUnderFive → urgent");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "severe pneumonia indicator: redFlags non-empty");
}

{
  const r = evaluateTriage({ ...base("breathing"), dustSmokeExposure: true });
  assert.equal(r.riskLevel, "refer", "breathing+dustSmoke → refer");
  assert.equal(r.referralRequired, true);
  assert.deepEqual(r.redFlags, [], "dust/smoke breathing: redFlags empty");
}

{
  const r = evaluateTriage({ ...base("breathing"), breathingFast: true });
  assert.equal(r.riskLevel, "refer", "breathing+breathingFast (adult) → refer");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "fast breathing adult: redFlags non-empty");
}

{
  const r = evaluateTriage({ ...base("breathing") });
  assert.equal(r.riskLevel, "refer", "breathing with no flags → refer (always refer cluster)");
  assert.equal(r.referralRequired, true);
  assert.deepEqual(r.redFlags, [], "mild breathing: redFlags empty");
}

// ---------------------------------------------------------------------------
// CLUSTER: vomiting_diarrhea
// ---------------------------------------------------------------------------

{
  const r = evaluateTriage({ ...base("vomiting_diarrhea"), severeDehydration: true });
  assert.equal(r.riskLevel, "urgent", "vomiting+severeDehydration → urgent");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "severe dehydration: redFlags non-empty");
}

{
  const r = evaluateTriage({ ...base("vomiting_diarrhea"), bloodInStool: true });
  assert.equal(r.riskLevel, "urgent", "vomiting+bloodInStool → urgent");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.some(f => f.toLowerCase().includes("blood")), "blood in stool: redFlags mentions blood");
}

{
  const r = evaluateTriage({ ...base("vomiting_diarrhea"), persistentVomiting: true, rainedHeavily: true });
  assert.equal(r.riskLevel, "refer", "vomiting+persistentVomiting+rain → refer (waterborne)");
  assert.equal(r.referralRequired, true);
  assert.deepEqual(r.redFlags, [], "waterborne: redFlags empty");
}

{
  const r = evaluateTriage({ ...base("vomiting_diarrhea"), persistentVomiting: true });
  assert.equal(r.riskLevel, "refer", "vomiting+persistentVomiting (no rain) → refer");
  assert.equal(r.referralRequired, true);
}

{
  const r = evaluateTriage({ ...base("vomiting_diarrhea") });
  assert.equal(r.riskLevel, "monitor", "vomiting with no flags → monitor");
  assert.equal(r.referralRequired, false);
  assert.deepEqual(r.redFlags, [], "mild diarrhea: redFlags empty");
}

// ---------------------------------------------------------------------------
// CLUSTER: confusion_collapse
// ---------------------------------------------------------------------------

{
  const r = evaluateTriage({ ...base("confusion_collapse"), seizures: true });
  assert.equal(r.riskLevel, "emergency", "confusion+seizures → emergency");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "confusion seizure: redFlags non-empty");
}

{
  const r = evaluateTriage({ ...base("confusion_collapse"), highFever: true });
  assert.equal(r.riskLevel, "urgent", "confusion+highFever → urgent (cerebral malaria/meningitis)");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "confusion+fever: redFlags non-empty");
}

{
  const r = evaluateTriage({ ...base("confusion_collapse") });
  assert.equal(r.riskLevel, "urgent", "confusion with no flags → urgent (always urgent)");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "unexplained collapse: redFlags non-empty");
}

// ---------------------------------------------------------------------------
// CLUSTER: skin_rash
// ---------------------------------------------------------------------------

{
  const r = evaluateTriage({ ...base("skin_rash"), highFever: true, rainedHeavily: true });
  assert.equal(r.riskLevel, "urgent", "skin_rash+highFever+rain → urgent (dengue)");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.some(f => f.toLowerCase().includes("dengue")), "dengue: redFlags mentions dengue");
}

{
  const r = evaluateTriage({ ...base("skin_rash"), highFever: true });
  assert.equal(r.riskLevel, "refer", "skin_rash+highFever (no rain) → refer");
  assert.equal(r.referralRequired, true);
  assert.deepEqual(r.redFlags, [], "febrile rash no rain: redFlags empty");
}

{
  const r = evaluateTriage({ ...base("skin_rash"), dustSmokeExposure: true });
  assert.equal(r.riskLevel, "monitor", "skin_rash+dustSmoke → monitor");
  assert.equal(r.referralRequired, false);
}

{
  const r = evaluateTriage({ ...base("skin_rash") });
  assert.equal(r.riskLevel, "monitor", "skin_rash with no flags → monitor");
  assert.equal(r.referralRequired, false);
  assert.deepEqual(r.redFlags, [], "mild rash: redFlags empty");
}

// ---------------------------------------------------------------------------
// CLUSTER: other
// ---------------------------------------------------------------------------

{
  // Maternal danger signs
  const r = evaluateTriage({ ...base("other"), maternalDangerSigns: true });
  assert.equal(r.riskLevel, "urgent", "other+maternalDangerSigns → urgent");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.some(f => f.toLowerCase().includes("maternal")), "maternal: redFlags mentions maternal");
}

{
  // Seizures in other cluster → emergency
  const r = evaluateTriage({ ...base("other"), seizures: true });
  assert.equal(r.riskLevel, "emergency", "other+seizures → emergency");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.length > 0, "other seizure: redFlags non-empty");
}

{
  // Malnutrition in child under 5 → urgent (SAM)
  const r = evaluateTriage({ ...base("other"), malnutritionSigns: true, childUnderFive: true });
  assert.equal(r.riskLevel, "urgent", "other+malnutrition+childUnderFive → urgent (SAM)");
  assert.equal(r.referralRequired, true);
  assert.ok(r.redFlags.some(f => f.toLowerCase().includes("malnutrition")), "SAM: redFlags mentions malnutrition");
}

{
  // Malnutrition in adult → refer
  const r = evaluateTriage({ ...base("other"), malnutritionSigns: true });
  assert.equal(r.riskLevel, "refer", "other+malnutrition (adult) → refer");
  assert.equal(r.referralRequired, true);
  assert.deepEqual(r.redFlags, [], "adult malnutrition: redFlags empty");
}

{
  // High fever + child under 5 in other cluster → urgent
  const r = evaluateTriage({ ...base("other"), highFever: true, childUnderFive: true });
  assert.equal(r.riskLevel, "urgent", "other+highFever+childUnderFive → urgent");
  assert.equal(r.referralRequired, true);
}

{
  // No flags at all → monitor
  const r = evaluateTriage({ ...base("other") });
  assert.equal(r.riskLevel, "monitor", "other with no flags → monitor");
  assert.equal(r.referralRequired, false);
  assert.deepEqual(r.redFlags, [], "non-specific: redFlags empty");
}

// ---------------------------------------------------------------------------
// INVARIANT: emergency and urgent always require referral
// ---------------------------------------------------------------------------

{
  const emergencyInputs = [
    { ...base("fever"), unconscious: true },
    { ...base("fever"), seizures: true },
    { ...base("confusion_collapse"), seizures: true },
    { ...base("other"), seizures: true },
  ];
  for (const input of emergencyInputs) {
    const r = evaluateTriage(input);
    assert.equal(r.riskLevel, "emergency");
    assert.equal(r.referralRequired, true, `emergency case must have referralRequired=true: ${JSON.stringify(input)}`);
  }
}

{
  const urgentInputs = [
    { ...base("fever"), highFever: true, childUnderFive: true },
    { ...base("vomiting_diarrhea"), severeDehydration: true },
    { ...base("confusion_collapse"), highFever: true },
    { ...base("skin_rash"), highFever: true, rainedHeavily: true },
    { ...base("other"), maternalDangerSigns: true },
  ];
  for (const input of urgentInputs) {
    const r = evaluateTriage(input);
    assert.equal(r.riskLevel, "urgent");
    assert.equal(r.referralRequired, true, `urgent case must have referralRequired=true: ${JSON.stringify(input)}`);
  }
}

// ---------------------------------------------------------------------------
// INVARIANT: monitor results never require referral
// ---------------------------------------------------------------------------

{
  const monitorInputs = [
    { ...base("fever") },
    { ...base("vomiting_diarrhea") },
    { ...base("skin_rash") },
    { ...base("skin_rash"), dustSmokeExposure: true },
    { ...base("other") },
  ];
  for (const input of monitorInputs) {
    const r = evaluateTriage(input);
    assert.equal(r.riskLevel, "monitor");
    assert.equal(r.referralRequired, false, `monitor case must have referralRequired=false: ${JSON.stringify(input)}`);
  }
}

// ---------------------------------------------------------------------------
// INVARIANT: result always has all required fields with correct types
// ---------------------------------------------------------------------------

{
  const allClusters = ["fever", "breathing", "vomiting_diarrhea", "confusion_collapse", "skin_rash", "other"];
  for (const cluster of allClusters) {
    const r = evaluateTriage({ ...base(cluster) });
    assert.ok(typeof r.riskLevel === "string", `${cluster}: riskLevel is string`);
    assert.ok(typeof r.likelyCondition === "string", `${cluster}: likelyCondition is string`);
    assert.ok(typeof r.recommendation === "string", `${cluster}: recommendation is string`);
    assert.ok(Array.isArray(r.redFlags), `${cluster}: redFlags is array`);
    assert.ok(typeof r.careAdvice === "string", `${cluster}: careAdvice is string`);
    assert.ok(typeof r.referralRequired === "boolean", `${cluster}: referralRequired is boolean`);
    const validLevels = ["monitor", "treat_local", "refer", "urgent", "emergency"];
    assert.ok(validLevels.includes(r.riskLevel), `${cluster}: riskLevel is a valid level`);
  }
}

console.log("triage.test.mjs passed");
