import { NextRequest } from "next/server";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

function verifyCronAuth(r: NextRequest) { return r.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}`; }

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  if (!verifyCronAuth(request)) return fail(401, "unauthorized", "Cron secret required", requestId);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "DB not configured", requestId);
  const today = new Date(); today.setHours(0,0,0,0);
  const endpoint = new URL(`${url}/rest/v1/encounters`);
  endpoint.searchParams.set("select", "classification");
  endpoint.searchParams.set("created_at", `gte.${today.toISOString()}`);
  endpoint.searchParams.set("is_demo", "eq.false");
  const res = await fetch(endpoint.toString(), { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
  const rows = (await res.json()) as Array<{ classification: string }>;
  const agg: Record<string,number> = {};
  for (const r of rows) agg[r.classification] = (agg[r.classification] ?? 0) + 1;
  // Upsert aggregated metric into admin_config
  await fetch(`${url}/rest/v1/admin_config`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "daily_metrics", value: { date: today.toISOString().slice(0,10), totals: agg, count: rows.length } }),
    signal: AbortSignal.timeout(5000),
  });
  return ok({ date: today.toISOString().slice(0,10), totals: agg, totalEncounters: rows.length }, requestId);
}
