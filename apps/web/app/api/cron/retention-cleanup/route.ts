import { NextRequest } from "next/server";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

function verifyCronAuth(r: NextRequest) { return r.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}`; }

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  if (!verifyCronAuth(request)) return fail(401, "unauthorized", "Cron secret required", requestId);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "DB not configured", requestId);
  const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS ?? "365", 10);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const endpoint = new URL(`${url}/rest/v1/encounters`);
  endpoint.searchParams.set("created_at", `lt.${cutoff}`);
  endpoint.searchParams.set("deleted_at", "is.null");
  endpoint.searchParams.set("is_demo", "eq.false");
  const res = await fetch(endpoint.toString(), {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal,count=exact" },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(30000),
  });
  const softDeletedCount = parseInt(res.headers.get("content-range")?.split("/")[1] ?? "0", 10);
  return ok({ softDeletedCount, cutoffDate: cutoff, retentionDays }, requestId);
}
