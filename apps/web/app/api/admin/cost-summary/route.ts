import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";

export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"), { requireRole: ["supervisor", "admin"] });
  if (!user) return fail(403, "forbidden", "Supervisor or admin role required", requestId);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "config_error", "Supabase not configured", requestId);
  const endpoint = new URL(`${url}/rest/v1/ai_usage_log`);
  endpoint.searchParams.set("select", "provider,estimated_cost_usd");
  const res = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return fail(502, "db_error", "Failed to fetch cost data", requestId);
  const rows = (await res.json()) as Array<{ provider: string; estimated_cost_usd: string; input_tokens?: number; output_tokens?: number }>;
  // Aggregate by provider using Decimal-safe string arithmetic
  const agg: Record<string, { total_cost: number; total_calls: number; total_tokens: number }> = {};
  for (const r of rows) {
    if (!agg[r.provider]) agg[r.provider] = { total_cost: 0, total_calls: 0, total_tokens: 0 };
    agg[r.provider]!.total_cost += parseFloat(r.estimated_cost_usd ?? "0");
    agg[r.provider]!.total_calls += 1;
    agg[r.provider]!.total_tokens += (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
  }
  const result = Object.entries(agg).map(([provider, data]) => ({
    provider,
    total_cost: data.total_cost.toFixed(8),
    total_calls: data.total_calls,
    total_tokens: data.total_tokens,
  }));
  return ok(result, requestId);
}
