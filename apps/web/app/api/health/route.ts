import { ok, requestIdFrom } from "@/lib/server/api-response";
import { getRedis } from "@/lib/server/redis";

type CheckStatus = "ok" | "unavailable";
type OverallStatus = "ok" | "degraded" | "error";

type HealthResponse = {
  status: OverallStatus;
  checks: {
    redis: { status: CheckStatus; latencyMs: number | null };
    supabase: { status: CheckStatus; latencyMs: number | null };
  };
  version: string;
  timestamp: string;
};

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);

  // Check Redis availability and latency.
  let redisStatus: CheckStatus = "unavailable";
  let redisLatencyMs: number | null = null;
  const redis = getRedis();
  if (redis) {
    try {
      const redisStart = Date.now();
      await Promise.race([
        redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
      ]);
      redisLatencyMs = Date.now() - redisStart;
      redisStatus = "ok";
    } catch {
      redisStatus = "unavailable";
    }
  }

  // Check Supabase availability and latency.
  let supabaseStatus: CheckStatus = "unavailable";
  let supabaseLatencyMs: number | null = null;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnon) {
    try {
      const supabaseStart = Date.now();
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "HEAD",
        headers: { apikey: supabaseAnon },
        signal: AbortSignal.timeout(2000),
      });
      supabaseLatencyMs = Date.now() - supabaseStart;
      supabaseStatus = res.ok ? "ok" : "unavailable";
    } catch {
      supabaseStatus = "unavailable";
    }
  }

  // Determine overall status.
  const allUnavailable = redisStatus === "unavailable" && supabaseStatus === "unavailable";
  const anyUnavailable = redisStatus === "unavailable" || supabaseStatus === "unavailable";
  const overallStatus: OverallStatus = allUnavailable ? "error" : anyUnavailable ? "degraded" : "ok";

  const payload: HealthResponse = {
    status: overallStatus,
    checks: {
      redis: { status: redisStatus, latencyMs: redisLatencyMs },
      supabase: { status: supabaseStatus, latencyMs: supabaseLatencyMs },
    },
    version: "0.2.0",
    timestamp: new Date().toISOString(),
  };

  return ok(payload, requestId);
}
