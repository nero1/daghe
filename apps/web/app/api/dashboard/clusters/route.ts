import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getCachedDashboardSummary, cacheDashboardSummary } from "@/lib/server/redis";

// Detects temporal case clusters: groups of 3+ cases with the same illness type
// within a 3-day rolling window. This is a lightweight heuristic suitable for CHW-level alerting.
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);
  if (user.role !== "supervisor" && user.role !== "admin") return fail(403, "ROLE_REQUIRED", "Supervisor or admin role required", requestId);

  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Dashboard backend not configured", requestId);

  const cacheKey = "clusters:7d";
  const cached = await getCachedDashboardSummary<unknown>(cacheKey);
  if (cached) return ok(cached, requestId);

  // Fetch urgent and emergency cases from the last 14 days for cluster analysis.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const endpoint = new URL(`${supabaseUrl}/rest/v1/cases`);
  endpoint.searchParams.set("select", "id,created_at,risk_level,triage_result,region_id,clinic_id");
  endpoint.searchParams.set("created_at", `gte.${since}`);
  endpoint.searchParams.set("order", "created_at.desc");
  endpoint.searchParams.set("limit", "500");

  const response = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch cases for cluster analysis", requestId);

  const cases = await response.json() as {
    id: string; created_at: string; risk_level: string;
    triage_result: { likelyCondition?: string }; region_id: string | null; clinic_id: string | null;
  }[];

  // Group by likely condition + 3-day window buckets.
  const buckets = new Map<string, { condition: string; count: number; regionId: string | null; clinicId: string | null; windowStart: string; windowEnd: string }>();

  for (const c of cases) {
    const condition = c.triage_result?.likelyCondition ?? "Unknown";
    const date = new Date(c.created_at);
    // Round to 3-day buckets.
    const bucketDay = Math.floor(date.getTime() / (3 * 24 * 60 * 60 * 1000));
    const bucketKey = `${condition}::${bucketDay}::${c.region_id ?? "none"}`;

    if (!buckets.has(bucketKey)) {
      const windowStart = new Date(bucketDay * 3 * 24 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date((bucketDay + 1) * 3 * 24 * 60 * 60 * 1000).toISOString();
      buckets.set(bucketKey, { condition, count: 0, regionId: c.region_id, clinicId: c.clinic_id, windowStart, windowEnd });
    }
    buckets.get(bucketKey)!.count += 1;
  }

  // Only report buckets with 3 or more cases (potential cluster signal).
  const clusters = [...buckets.values()]
    .filter((b) => b.count >= 3)
    .sort((a, b) => b.count - a.count);

  await cacheDashboardSummary(cacheKey, clusters, 120);
  return ok(clusters, requestId);
}
