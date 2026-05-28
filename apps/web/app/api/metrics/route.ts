import { fail, ok, requestIdFrom } from "@/lib/server/api-response";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  getCachedDashboardSummary,
  cacheDashboardSummary,
  acquireComputeLock,
  releaseComputeLock,
  getRedis,
} from "@/lib/server/redis";

const METRICS_CACHE_KEY = "metrics";
const METRICS_CACHE_TTL = 60;
const LOCK_TTL = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type MetricsData = {
  cases: { total: number; unsynced: number; today: number };
  byRiskLevel: Record<string, number>;
  auth: { activeSessions: string };
  redis: { available: boolean };
};

async function fetchCount(
  url: string,
  key: string,
  filters: Record<string, string>
): Promise<number> {
  const endpoint = new URL(`${url}/rest/v1/cases`);
  endpoint.searchParams.set("select", "id");
  for (const [k, v] of Object.entries(filters)) {
    endpoint.searchParams.set(k, v);
  }
  const res = await fetch(endpoint.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact,head=true" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return 0;
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request.headers.get("authorization"), {
    requireRole: ["admin"],
  });
  if (!user) return fail(401, "AUTH_REQUIRED", "Authentication required", requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(500, "SERVER_NOT_CONFIGURED", "Backend not configured", requestId);

  // Check Redis cache first.
  const cached = await getCachedDashboardSummary<MetricsData>(METRICS_CACHE_KEY);
  if (cached) return ok(cached, requestId);

  // Thundering herd protection.
  const lockAcquired = await acquireComputeLock(METRICS_CACHE_KEY, LOCK_TTL);
  if (!lockAcquired) {
    await sleep(500);
    const retried = await getCachedDashboardSummary<MetricsData>(METRICS_CACHE_KEY);
    if (retried) return ok(retried, requestId);
    // Still empty — fall through to compute.
  }

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [total, unsynced, today, monitor, treat_local, refer, urgent, emergency] =
      await Promise.all([
        fetchCount(url, key, {}),
        fetchCount(url, key, { synced_at: "is.null" }),
        fetchCount(url, key, { created_at: `gte.${todayIso}` }),
        fetchCount(url, key, { risk_level: "eq.monitor" }),
        fetchCount(url, key, { risk_level: "eq.treat_local" }),
        fetchCount(url, key, { risk_level: "eq.refer" }),
        fetchCount(url, key, { risk_level: "eq.urgent" }),
        fetchCount(url, key, { risk_level: "eq.emergency" }),
      ]);

    const redis = getRedis();
    const metrics: MetricsData = {
      cases: { total, unsynced, today },
      byRiskLevel: { monitor, treat_local, refer, urgent, emergency },
      auth: { activeSessions: "N/A - use Supabase dashboard" },
      redis: { available: redis !== null },
    };

    await cacheDashboardSummary(METRICS_CACHE_KEY, metrics, METRICS_CACHE_TTL);
    return ok(metrics, requestId);
  } finally {
    if (lockAcquired) await releaseComputeLock(METRICS_CACHE_KEY);
  }
}
