import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { acquireComputeLock, releaseComputeLock, cacheTriageRules, getCachedTriageRules } from "@/lib/server/redis";

type RulesVersion = { version: string; language: string; rules_json: unknown; is_active: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const lang = new URL(request.url).searchParams.get("lang") ?? "en";
  // BUG-011 fix: validate language to prevent cache/query key pollution.
  if (!["en","ha","yo","ig","fr","ar","sw","am","om","ln","tw","ee","gaa","dag"].includes(lang)) return fail(400, "VALIDATION_ERROR", "Unsupported language", requestId);

  const cacheKey = `rules:${lang}`;

  // Check Redis cache first (thundering herd: hot path).
  const cached = await getCachedTriageRules(cacheKey);
  if (cached) return ok(cached as RulesVersion, requestId);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Return the current built-in version when Supabase is not configured.
    return ok({ version: "v2", language: lang, is_active: true, rules_json: {} }, requestId);
  }

  // Thundering herd protection: only one worker should fetch from Supabase.
  const lockAcquired = await acquireComputeLock(cacheKey, 10);
  if (!lockAcquired) {
    // Another worker is already computing — wait 500ms and retry from cache.
    await sleep(500);
    const retried = await getCachedTriageRules(cacheKey);
    if (retried) return ok(retried as RulesVersion, requestId);
    // Cache still empty after waiting — fall through and fetch anyway.
  }

  try {
    const endpoint = new URL(`${url}/rest/v1/triage_rules`);
    endpoint.searchParams.set("select", "version,language,rules_json,is_active");
    endpoint.searchParams.set("is_active", "eq.true");
    endpoint.searchParams.set("language", `eq.${lang}`);
    endpoint.searchParams.set("order", "created_at.desc");
    endpoint.searchParams.set("limit", "1");

    const response = await fetch(endpoint.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return fail(502, "UPSTREAM_ERROR", "Failed to fetch triage rules", requestId);

    const rows = await response.json() as RulesVersion[];
    const rule = rows[0] ?? { version: "v2", language: lang, is_active: true, rules_json: {} };

    // Cache for 1 hour — rules change rarely and version bumps invalidate automatically.
    await cacheTriageRules(cacheKey, rule, 3600);
    return ok(rule, requestId);
  } finally {
    if (lockAcquired) await releaseComputeLock(cacheKey);
  }
}
