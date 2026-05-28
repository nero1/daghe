import { ok, requestIdFrom } from "@/lib/server/api-response";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  // Returns current model version for service worker model-version checking.
  // In Phase 4, this will query the modules table. For now, reads from env var.
  const version = process.env.TFLITE_MODEL_VERSION ?? "1.0.0";
  return ok({ version }, requestId);
}
