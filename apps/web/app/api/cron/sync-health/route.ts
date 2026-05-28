import { NextRequest } from "next/server";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

function verifyCronAuth(request: NextRequest): boolean {
  const expected = `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}`;
  return request.headers.get("authorization") === expected;
}

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  if (!verifyCronAuth(request)) return fail(401, "unauthorized", "Cron secret required", requestId);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "DB not configured", requestId);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endpoint = new URL(`${url}/rest/v1/encounters`);
  endpoint.searchParams.set("select", "id");
  endpoint.searchParams.set("sync_status", "eq.pending");
  endpoint.searchParams.set("created_at", `lt.${cutoff}`);
  const res = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
    signal: AbortSignal.timeout(10000),
  });
  const stuckCount = parseInt(res.headers.get("content-range")?.split("/")[1] ?? "0", 10);
  return ok({ stuckPendingCount: stuckCount, checkedAt: new Date().toISOString() }, requestId);
}
