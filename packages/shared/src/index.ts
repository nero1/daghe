import { z } from "zod";

export const symptomClusterSchema = z.enum([
  "fever",
  "breathing",
  "vomiting_diarrhea",
  "confusion_collapse",
  "skin_rash",
  "other"
]);

export const triageInputSchema = z.object({
  cluster: symptomClusterSchema,
  // Core risk flags
  childUnderFive: z.boolean(),
  unconscious: z.boolean(),
  severeDehydration: z.boolean(),
  highFever: z.boolean(),
  // Extended contextual flags
  rainedHeavily: z.boolean(),
  breathingFast: z.boolean(),
  dustSmokeExposure: z.boolean(),
  persistentVomiting: z.boolean(),
  bloodInStool: z.boolean(),
  seizures: z.boolean(),
  maternalDangerSigns: z.boolean(),
  malnutritionSigns: z.boolean(),
});

export type TriageInput = z.infer<typeof triageInputSchema>;

export type TriageResult = {
  outcomeKey: string;
  riskLevel: "monitor" | "treat_local" | "refer" | "urgent" | "emergency";
  likelyCondition: string;
  recommendation: string;
  redFlags: string[];
  careAdvice: string;
  referralRequired: boolean;
};

// Ordered list of follow-up question flags per symptom cluster (clinical priority order).
export const clusterQuestions: Record<string, Array<keyof Omit<TriageInput, "cluster">>> = {
  fever: ["unconscious", "seizures", "childUnderFive", "highFever", "rainedHeavily"],
  breathing: ["unconscious", "breathingFast", "childUnderFive", "dustSmokeExposure"],
  vomiting_diarrhea: ["unconscious", "severeDehydration", "persistentVomiting", "bloodInStool", "rainedHeavily"],
  confusion_collapse: ["unconscious", "highFever", "seizures"],
  skin_rash: ["highFever", "rainedHeavily", "dustSmokeExposure"],
  other: ["unconscious", "maternalDangerSigns", "seizures", "highFever", "malnutritionSigns", "childUnderFive"],
};

// Decision order matters: earlier branches represent higher clinical urgency.
export function evaluateTriage(input: TriageInput): TriageResult {
  // Unconsciousness is an emergency regardless of cluster.
  if (input.unconscious) {
    return {
      outcomeKey: "unconscious",
      riskLevel: "emergency",
      likelyCondition: "Severe acute illness — possible heatstroke, meningitis, or severe malaria",
      recommendation: "Immediate emergency escalation — call for ambulance or emergency transport now",
      redFlags: ["Patient is unconscious or unresponsive", "Do not leave patient alone"],
      careAdvice: "Keep airway clear. Place in recovery position if breathing. Do not give food or water. Call emergency services now.",
      referralRequired: true,
    };
  }

  if (input.cluster === "fever") {
    // Seizures with fever indicate possible meningitis or cerebral malaria.
    if (input.seizures) {
      return {
        outcomeKey: "fever_seizure",
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
        outcomeKey: "fever_child_highfever",
        riskLevel: "urgent",
        likelyCondition: "Severe febrile illness in child under 5 — possible severe malaria",
        recommendation: "Urgent referral — transport to clinic within 1–2 hours",
        redFlags: ["High fever in child under 5", "Risk of febrile seizure"],
        careAdvice: "Give paracetamol if available. Cool child with damp cloth. Give oral fluids if conscious. Transport urgently.",
        referralRequired: true,
      };
    }
    // Post-rainfall fever: malaria surge context.
    if (input.rainedHeavily && input.highFever) {
      return {
        outcomeKey: "fever_rainfall_highfever",
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
        outcomeKey: "fever_highfever",
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
        outcomeKey: "fever_rainfall",
        riskLevel: "refer",
        likelyCondition: "Post-rainfall fever — possible early malaria",
        recommendation: "Refer for malaria rapid test given recent rainfall",
        redFlags: [],
        careAdvice: "Monitor temperature. Encourage fluids. Refer for malaria test given recent rainfall in the area.",
        referralRequired: true,
      };
    }
    return {
      outcomeKey: "fever_mild",
      riskLevel: "monitor",
      likelyCondition: "Mild fever — non-specific",
      recommendation: "Monitor with follow-up in 24 hours",
      redFlags: [],
      careAdvice: "Rest and increase fluid intake. Give paracetamol if fever rises. Return if no improvement in 24 hours.",
      referralRequired: false,
    };
  }

  if (input.cluster === "breathing") {
    // Fast breathing in child under 5 is a WHO danger sign for severe pneumonia.
    if (input.breathingFast && input.childUnderFive) {
      return {
        outcomeKey: "breathing_child_fast",
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
        outcomeKey: "breathing_dust",
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
        outcomeKey: "breathing_fast",
        riskLevel: "refer",
        likelyCondition: "Possible pneumonia or acute respiratory illness",
        recommendation: "Refer to clinic same day for chest assessment",
        redFlags: ["Fast breathing noted — possible lower respiratory infection"],
        careAdvice: "Keep patient calm and in upright position. Do not force fluids if breathing is laboured. Refer today.",
        referralRequired: true,
      };
    }
    return {
      outcomeKey: "breathing_other",
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
        outcomeKey: "vomiting_dehydration",
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
        outcomeKey: "vomiting_blood",
        riskLevel: "urgent",
        likelyCondition: "Possible dysentery or severe gastrointestinal infection",
        recommendation: "Urgent referral — blood in stool requires clinical assessment",
        redFlags: ["Blood in stool detected — possible dysentery"],
        careAdvice: "Give ORS to prevent dehydration. Do not give anti-diarrheal medications. Transport urgently.",
        referralRequired: true,
      };
    }
    // Flooding/rainfall context raises waterborne illness risk.
    if (input.persistentVomiting && input.rainedHeavily) {
      return {
        outcomeKey: "vomiting_waterborne",
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
        outcomeKey: "vomiting_persistent",
        riskLevel: "refer",
        likelyCondition: "Persistent vomiting / diarrheal disease",
        recommendation: "Refer to clinic if unable to keep fluids down",
        redFlags: [],
        careAdvice: "Give small sips of ORS frequently. Monitor hydration signs. Refer if unable to keep fluids down.",
        referralRequired: true,
      };
    }
    return {
      outcomeKey: "vomiting_mild",
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
        outcomeKey: "confusion_seizure",
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
        outcomeKey: "confusion_fever",
        riskLevel: "urgent",
        likelyCondition: "Confusion with high fever — possible cerebral malaria or meningitis",
        recommendation: "Urgent referral — transport immediately",
        redFlags: ["Altered consciousness with fever — meningitis or cerebral malaria possible"],
        careAdvice: "Do not give anything by mouth. Keep airway clear. Transport immediately to nearest clinic.",
        referralRequired: true,
      };
    }
    return {
      outcomeKey: "confusion_other",
      riskLevel: "urgent",
      likelyCondition: "Confusion or collapse — cause unknown, urgent evaluation required",
      recommendation: "Urgent referral — clinical evaluation required",
      redFlags: ["Altered mental status or collapse — cause unknown"],
      careAdvice: "Keep patient safe and still. Monitor breathing and pulse. Transport urgently.",
      referralRequired: true,
    };
  }

  if (input.cluster === "skin_rash") {
    // Dengue classic presentation: rash + fever + post-rainfall context.
    if (input.highFever && input.rainedHeavily) {
      return {
        outcomeKey: "rash_dengue",
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
        outcomeKey: "rash_fever",
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
        outcomeKey: "rash_dust",
        riskLevel: "monitor",
        likelyCondition: "Skin irritation from dust or smoke/wildfire exposure",
        recommendation: "Monitor and remove patient from exposure",
        redFlags: [],
        careAdvice: "Move away from smoke or dust. Keep skin clean and dry. Refer if rash spreads or blisters form.",
        referralRequired: false,
      };
    }
    return {
      outcomeKey: "rash_other",
      riskLevel: "monitor",
      likelyCondition: "Skin rash or mild skin infection",
      recommendation: "Monitor and keep affected area clean",
      redFlags: [],
      careAdvice: "Keep rash area clean and dry. Avoid scratching. Return if rash spreads, blisters, or fever develops.",
      referralRequired: false,
    };
  }

  // Cluster: other (catch-all for symptoms not in primary clusters)
  if (input.maternalDangerSigns) {
    return {
      outcomeKey: "other_maternal",
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
      outcomeKey: "other_seizure",
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
      outcomeKey: "other_child_fever",
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
      outcomeKey: "other_sam",
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
      outcomeKey: "other_malnutrition",
      riskLevel: "refer",
      likelyCondition: "Possible malnutrition",
      recommendation: "Refer to clinic for nutritional assessment",
      redFlags: [],
      careAdvice: "Encourage nutrient-rich foods if available. Refer for full nutritional assessment at clinic.",
      referralRequired: true,
    };
  }
  return {
    outcomeKey: "other_nonspecific",
    riskLevel: "monitor",
    likelyCondition: "Non-specific symptoms",
    recommendation: "Monitor with follow-up in 24–48 hours",
    redFlags: [],
    careAdvice: "Rest and increase fluid intake. Return if symptoms worsen or new symptoms develop.",
    referralRequired: false,
  };
}
