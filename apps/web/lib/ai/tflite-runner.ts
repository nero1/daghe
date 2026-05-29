import type { ConditionModule, ModuleResult, ConfidenceBand } from "@daghe/shared";
import { applyConfidenceOverride } from "@daghe/shared";
import { CONFIDENCE_THRESHOLDS } from "./constants";

export type TFLiteRunResult = ModuleResult | null;
export type ROIResult = { confidence: number; cropBox?: { x: number; y: number; w: number; h: number } };

function scoreToBand(score: number): ConfidenceBand {
  if (score >= CONFIDENCE_THRESHOLDS.high) return "HIGH";
  if (score >= CONFIDENCE_THRESHOLDS.moderate) return "MODERATE";
  return "LOW";
}

// Dynamically imports TFJS-tflite — this must never appear in the initial bundle.
// Returns null if the WASM backend is unavailable (triggers cloud AI fallback).
export async function runTFLiteInference(
  imageData: ImageData,
  moduleConfig: ConditionModule
): Promise<TFLiteRunResult> {
  try {
    // Dynamic import keeps TFLite out of the initial bundle — Phase 3 requirement.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { loadTFLiteModel } = await import("@tensorflow/tfjs-tflite" as any);

    // Step 1: Detection model — ROI localisation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detectionModel: any = await loadTFLiteModel(`/models/${moduleConfig.tfliteDetectionModel}`);

    // Step 2: Classification model — acetowhite lesion classification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const classificationModel: any = await loadTFLiteModel(`/models/${moduleConfig.tfliteClassificationModel}`);

    // Convert ImageData to tensor input (placeholder — full implementation requires
    // tf.browser.fromPixels which is available once @tensorflow/tfjs-core is loaded)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: tf } = await import("@tensorflow/tfjs-core" as any) as { default: any };
    await import("@tensorflow/tfjs-backend-wasm" as any);
    await tf.setBackend("wasm");
    await tf.ready();

    const imageTensor = tf.browser.fromPixels(imageData);

    // Detection: returns bounding box + confidence
    const detectionInput = tf.image.resizeBilinear(imageTensor, [320, 320]);
    const detectionBatch = detectionInput.expandDims(0);
    const detectionOutput = detectionModel.predict(detectionBatch);

    // Parse detection confidence (simplified — real parsing depends on model output schema)
    const detectionData = await (Array.isArray(detectionOutput) ? detectionOutput[0] : detectionOutput).data();
    const roiConfidence = (detectionData as Float32Array)[0] ?? 0;

    if (roiConfidence < moduleConfig.roiConfidenceThreshold) {
      tf.dispose([imageTensor, detectionInput, detectionBatch, detectionOutput]);
      return null;
    }

    // Classification: resize to 224x224 (MobileNetV2 input)
    const classificationInput = tf.image.resizeBilinear(imageTensor, [224, 224]);
    const classificationBatch = classificationInput.expandDims(0).div(255.0);
    const classificationOutput = classificationModel.predict(classificationBatch);
    const classificationData = await (Array.isArray(classificationOutput) ? classificationOutput[0] : classificationOutput).data();

    // Model output: [negative_score, positive_score, indeterminate_score]
    const scores = Array.from(classificationData as Float32Array);
    const maxIdx = scores.indexOf(Math.max(...scores));
    const maxScore = scores[maxIdx] ?? 0;

    const classificationMap: Record<number, "POSITIVE" | "NEGATIVE" | "REFER"> = {
      0: "NEGATIVE",
      1: "POSITIVE",
      2: "REFER",
    };
    const classification = classificationMap[maxIdx] ?? "REFER";
    const confidenceBand = scoreToBand(maxScore);

    tf.dispose([imageTensor, detectionInput, detectionBatch, classificationInput, classificationBatch, classificationOutput]);

    const result: ModuleResult = {
      classification,
      confidenceBand,
      inferenceMethod: "tflite",
      confidenceScore: maxScore,
      confidenceSentence: `On-device AI result. Confidence: ${Math.round(maxScore * 100)}%.`,
      recommendedAction: classification === "NEGATIVE"
        ? "Routine rescreening in 3 years."
        : classification === "POSITIVE"
        ? "Refer for colposcopy or consider same-visit cryotherapy if eligible."
        : "Escalate to supervising clinician.",
      referralRequired: classification !== "NEGATIVE",
      qualityOverrideUsed: false,
    };

    return applyConfidenceOverride(result);
  } catch {
    // WASM unavailable, model not yet downloaded, or any other failure.
    // Return null to signal the fallback chain should continue to cloud AI.
    return null;
  }
}
