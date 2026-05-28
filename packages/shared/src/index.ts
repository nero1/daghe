import { z } from "zod";

// ─── Core classification types ───────────────────────────────────────────────

export type ViaClassification = "POSITIVE" | "NEGATIVE" | "REFER";

export type ConfidenceBand = "HIGH" | "MODERATE" | "LOW" | "REFERENCE_ONLY";

export type InferenceMethod = "tflite" | "gemini" | "gpt4o" | "rule-based" | "reference";

export type ScreeningContext = "routine" | "referral" | "hpv-positive-triage";

export type ActionTaken = "treated" | "referred" | "monitored" | "declined";

// ─── Module result ────────────────────────────────────────────────────────────

export type ModuleResult = {
  classification: ViaClassification;
  confidenceBand: ConfidenceBand;
  inferenceMethod: InferenceMethod;
  confidenceScore?: number;
  confidenceSentence: string;
  recommendedAction: string;
  referralRequired: boolean;
  qualityOverrideUsed: boolean;
};

// Critical clinical safety rule: LOW or REFERENCE_ONLY confidence always overrides
// classification to REFER. This must be called at the result rendering layer without exception.
export function applyConfidenceOverride(result: ModuleResult): ModuleResult {
  if (result.confidenceBand === "LOW" || result.confidenceBand === "REFERENCE_ONLY") {
    return { ...result, classification: "REFER", referralRequired: true };
  }
  return result;
}

// ─── Condition module descriptor ─────────────────────────────────────────────

export type ConditionModule = {
  id: string;
  version: string;
  name: Record<string, string>;
  inputType: "camera-image" | "uploaded-image";
  tfliteDetectionModel: string;
  tfliteClassificationModel: string;
  fallbackLogicPath: string;
  demoImages: string[];
  blurThreshold: number;
  exposureMin: number;
  exposureMax: number;
  roiConfidenceThreshold: number;
};

// ─── Encounter (replaces LocalCase) ──────────────────────────────────────────

export type LocalEncounter = {
  id: string;
  facilityId: string | null;
  userId: string | null;
  moduleId: string;
  patientAgeBand: string;
  screeningContext: ScreeningContext;
  result: ModuleResult;
  imageHash: string | null;
  actionTaken?: ActionTaken;
  notes?: string;
  qualityOverride: boolean;
  inferenceMethod: InferenceMethod;
  appVersion: string;
  moduleVersion: string;
  deviceLocalTime: string;
  utcTime: string;
  syncStatus: "pending" | "synced" | "failed";
  retryCount: number;
  nextRetryAt?: string;
  idempotencyKey: string;
  isDemoEncounter: boolean;
};

// ─── Zod validation schemas ──────────────────────────────────────────────────

export const viaClassificationSchema = z.enum(["POSITIVE", "NEGATIVE", "REFER"]);

export const confidenceBandSchema = z.enum(["HIGH", "MODERATE", "LOW", "REFERENCE_ONLY"]);

export const inferenceMethodSchema = z.enum(["tflite", "gemini", "gpt4o", "rule-based", "reference"]);

export const screeningContextSchema = z.enum(["routine", "referral", "hpv-positive-triage"]);

export const actionTakenSchema = z.enum(["treated", "referred", "monitored", "declined"]);

export const moduleResultSchema = z.object({
  classification: viaClassificationSchema,
  confidenceBand: confidenceBandSchema,
  inferenceMethod: inferenceMethodSchema,
  confidenceScore: z.number().min(0).max(1).optional(),
  confidenceSentence: z.string().max(500),
  recommendedAction: z.string().max(500),
  referralRequired: z.boolean(),
  qualityOverrideUsed: z.boolean(),
});

export const localEncounterSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  moduleId: z.string().max(100),
  patientAgeBand: z.string().max(20),
  screeningContext: screeningContextSchema,
  result: moduleResultSchema,
  imageHash: z.string().regex(/^[a-f0-9]{64}$/, "must be a SHA-256 hex string").nullable(),
  actionTaken: actionTakenSchema.optional(),
  notes: z.string().max(500).optional(),
  qualityOverride: z.boolean(),
  inferenceMethod: inferenceMethodSchema,
  appVersion: z.string().max(50),
  moduleVersion: z.string().max(50),
  deviceLocalTime: z.string().datetime({ offset: true }),
  utcTime: z.string().datetime(),
  syncStatus: z.enum(["pending", "synced", "failed"]),
  retryCount: z.number().int().min(0),
  nextRetryAt: z.string().datetime().optional(),
  idempotencyKey: z.string().uuid(),
  isDemoEncounter: z.boolean(),
});

export type ValidatedLocalEncounter = z.infer<typeof localEncounterSchema>;
