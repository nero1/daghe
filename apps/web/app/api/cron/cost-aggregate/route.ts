import { NextRequest } from "next/server";
import Decimal from "decimal.js";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

function verifyCronAuth(r: NextRequest) { return r.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}`; }

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  if (!verifyCronAuth(request)) return fail(401, "unauthorized", "Cron secret required", requestId);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "DB not configured", requestId);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const endpoint = new URL(`${url}/rest/v1/ai_usage_log`);
  endpoint.searchParams.set("select", "provider,estimated_cost_usd");
  endpoint.searchParams.set("created_at", `gte.${monthStart.toISOString()}`);
  const res = await fetch(endpoint.toString(), { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  const rows = (await res.json()) as Array<{ provider: string; estimated_cost_usd: string }>;
  const byProvider: Record<string, Decimal> = {};
  let total = new Decimal(0);
  for (const r of rows) {
    const cost = new Decimal(r.estimated_cost_usd ?? "0");
    byProvider[r.provider] = (byProvider[r.provider] ?? new Decimal(0)).plus(cost);
    total = total.plus(cost);
  }
  const summary = { month: monthStart.toISOString().slice(0,7), totalUsd: total.toFixed(8), byProvider: Object.fromEntries(Object.entries(byProvider).map(([k,v]) => [k, v.toFixed(8)])) };
  await fetch(`${url}/rest/v1/admin_config`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "monthly_cost_summary", value: summary }),
    signal: AbortSignal.timeout(5000),
  });
  return ok(summary, requestId);
}
