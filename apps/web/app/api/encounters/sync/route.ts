import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { verifyCsrf } from "@/lib/server/security";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { checkAndStoreIdempotencyKey } from "@/lib/server/redis";
import { localEncounterSchema } from "@daghe/shared";

const payloadSchema = z.object({
  encounters: z.array(localEncounterSchema).min(1).max(50),
});

type SyncResult = { id: string; status: "synced" | "duplicate" | "failed"; message?: string };

const CONCURRENCY = 5;
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pushOne(
  enc: z.infer<typeof localEncounterSchema>,
  url: string,
  key: string
): Promise<SyncResult> {
  // Reject demo encounters — they must never reach the server.
  if (enc.isDemoEncounter) return { id: enc.id, status: "failed", message: "demo_encounter_rejected" };

  // Redis idempotency check: skip the DB entirely for already-seen keys.
  const isNew = await checkAndStoreIdempotencyKey(enc.idempotencyKey);
  if (!isNew) return { id: enc.id, status: "duplicate" };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${url}/rest/v1/encounters`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          id: enc.id,
          idempotency_key: enc.idempotencyKey,
          facility_id: enc.facilityId,
          user_id: enc.userId,
          module_id: enc.moduleId,
          patient_age_band: enc.patientAgeBand,
          screening_context: enc.screeningContext,
          classification: enc.result.classification,
          confidence_band: enc.result.confidenceBand,
          inference_method: enc.inferenceMethod,
          confidence_score: enc.result.confidenceScore ?? null,
          quality_override: enc.qualityOverride,
          action_taken: enc.actionTaken ?? null,
          image_hash: enc.imageHash,
          app_version: enc.appVersion,
          module_version: enc.moduleVersion,
          device_local_time: enc.deviceLocalTime,
          is_demo: false,
          synced_at: new Date().toISOString(),
        }),
      });
      if (response.ok) return { id: enc.id, status: "synced" };
      const errorText = await response.text();
      const duplicate = errorText.includes("duplicate key") || response.status === 409;
      if (duplicate) return { id: enc.id, status: "duplicate" };
      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      return { id: enc.id, status: "failed", message: `upstream_${response.status}` };
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      return { id: enc.id, status: "failed", message: "network_or_timeout" };
    }
  }
  return { id: enc.id, status: "failed", message: "unreachable" };
}

async function syncToSupabase(
  encounters: z.infer<typeof localEncounterSchema>[]
): Promise<SyncResult[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return encounters.map((e) => ({ id: e.id, status: "failed", message: "Server sync not configured" }));
  }
  const results: SyncResult[] = [];
  for (let i = 0; i < encounters.length; i += CONCURRENCY) {
    const slice = encounters.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(slice.map((e) => pushOne(e, url, key)));
    results.push(...batch);
  }
  return results;
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  if (!(await verifyCsrf(request))) return fail(403, "CSRF_INVALID", "CSRF validation failed", requestId);
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = await checkRateLimit(`sync:${ip}`, 30, 60_000);
  if (!rate.ok) return fail(429, "RATE_LIMITED", "Too many requests", requestId, { retryAfterSec: rate.retryAfterSec });
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Validation error", requestId, parsed.error.flatten());

  const results = await syncToSupabase(parsed.data.encounters);
  return ok({ results }, requestId);
}
