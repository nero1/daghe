import { NextRequest } from "next/server";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

function verifyCronAuth(r: NextRequest) { return r.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}`; }

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  if (!verifyCronAuth(request)) return fail(401, "unauthorized", "Cron secret required", requestId);
  const currentVersion = process.env.TFLITE_MODEL_VERSION ?? "1.0.0";
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "DB not configured", requestId);
  const res = await fetch(`${url}/rest/v1/modules?id=eq.cervical-via&select=model_version`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000),
  });
  const rows = (await res.json()) as Array<{ model_version: string }>;
  const dbVersion = rows[0]?.model_version ?? "1.0.0";
  return ok({ currentVersion, dbVersion, updateAvailable: currentVersion !== dbVersion }, requestId);
}
