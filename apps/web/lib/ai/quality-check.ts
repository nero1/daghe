import type { ConditionModule } from "@daghe/shared";

export type QualityCheckResult =
  | { ok: true }
  | { ok: false; reason: "blur" | "exposure" | "framing"; messageKey: string };

// Laplacian variance blur detection.
// Convolves the luminance channel with the Laplacian kernel [[0,1,0],[1,-4,1],[0,1,0]]
// and computes the variance of the result. Higher variance = sharper image.
export function checkBlur(imageData: ImageData, threshold: number): boolean {
  const { data, width, height } = imageData;
  const luma: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // BT.601 luminance coefficients
    luma.push(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
  }

  const laplacian: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val =
        -4 * luma[idx]! +
        luma[idx - 1]! +
        luma[idx + 1]! +
        luma[idx - width]! +
        luma[idx + width]!;
      laplacian.push(val);
    }
  }

  const mean = laplacian.reduce((s, v) => s + v, 0) / laplacian.length;
  const variance = laplacian.reduce((s, v) => s + (v - mean) ** 2, 0) / laplacian.length;
  return variance >= threshold;
}

// Mean pixel brightness check (0–255 scale).
export function checkExposure(imageData: ImageData, min: number, max: number): boolean {
  const { data } = imageData;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
  }
  const mean = sum / (data.length / 4);
  return mean >= min && mean <= max;
}

// Runs all three quality checks in sequence.
// The framing check (ROI detection) relies on a pre-computed roiResult from the TFLite
// detection model; pass null if TFLite is unavailable (framing check will be skipped).
export function runQualityChecks(
  imageData: ImageData,
  moduleConfig: ConditionModule,
  roiResult: { confidence: number } | null
): QualityCheckResult {
  if (!checkExposure(imageData, moduleConfig.exposureMin, moduleConfig.exposureMax)) {
    return { ok: false, reason: "exposure", messageKey: "qualityExposure" };
  }
  if (!checkBlur(imageData, moduleConfig.blurThreshold)) {
    return { ok: false, reason: "blur", messageKey: "qualityBlur" };
  }
  if (roiResult !== null && roiResult.confidence < moduleConfig.roiConfidenceThreshold) {
    return { ok: false, reason: "framing", messageKey: "qualityFraming" };
  }
  return { ok: true };
}
